/**
 * @wc/auth — Account service (register / login / daily check-in).
 * Source of truth: PRD §03 (Auth) + §04 (signup 1000, daily 200, UTC+7) + §16.
 * Password hashing: bcryptjs (pure JS). JWT/cookie handling lives in the web API layer.
 */
import type { PrismaClient } from '@wc/db';
import bcrypt from 'bcryptjs';
import { checkinReward } from '@wc/core';

const SIGNUP_BONUS = 1000n;
const TZ_OFFSET_MS = 7 * 3600 * 1000; // UTC+7 (PRD OQ-07)
const BCRYPT_ROUNDS = 10;

export interface SessionUser {
  id: bigint;
  email: string;
  role: string;
}

/** Register: create user + GLOBAL wallet (1000) + SIGNUP ledger, atomically. */
export async function registerUser(
  prisma: PrismaClient,
  input: { email: string; username?: string; password: string },
): Promise<SessionUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error('EMAIL_TAKEN');
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, username: input.username, passwordHash },
    });
    await tx.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: SIGNUP_BONUS } });
    await tx.pointLedger.create({
      data: {
        userId: user.id, contextType: 'GLOBAL', type: 'SIGNUP',
        amount: SIGNUP_BONUS, balanceAfter: SIGNUP_BONUS, refType: 'USER', refId: user.id,
      },
    });
    return { id: user.id, email: user.email, role: user.role };
  });
}

/** Verify login credentials. Throws INVALID_CREDENTIALS / BANNED. */
export async function verifyLogin(
  prisma: PrismaClient,
  input: { email: string; password: string },
): Promise<SessionUser> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw new Error('INVALID_CREDENTIALS');
  if (user.status === 'BANNED') throw new Error('BANNED');
  const ok = await bcrypt.compare(input.password, user.passwordHash);
  if (!ok) throw new Error('INVALID_CREDENTIALS');
  return { id: user.id, email: user.email, role: user.role };
}

/** Start of the current calendar day in UTC+7, expressed as a UTC instant. */
function startOfDayUtc7(now: Date): Date {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  const dayStart = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
  return new Date(dayStart - TZ_OFFSET_MS);
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Daily check-in: +200–400 streak-tiered (ENG-01) once per UTC+7 calendar day. Throws ALREADY_CHECKED_IN.
 * The logical "day" is tracked on Streak.lastCheckinDate (start-of-day UTC+7 instant),
 * so it is independent of DB row insertion time and deterministic for a given `now`.
 */
export async function dailyCheckin(
  prisma: PrismaClient,
  userId: bigint,
  now: Date = new Date(),
): Promise<{ balance: bigint; reward: bigint; streak: number }> {
  const dayStart = startOfDayUtc7(now);
  return prisma.$transaction(async (tx) => {
    const streak = await tx.streak.findUnique({ where: { userId } });
    if (streak?.lastCheckinDate && streak.lastCheckinDate.getTime() === dayStart.getTime()) {
      throw new Error('ALREADY_CHECKED_IN');
    }
    // compute new streak before crediting so reward is based on the post-checkin streak
    const prevDay = new Date(dayStart.getTime() - DAY_MS);
    const consecutive = !!streak?.lastCheckinDate && streak.lastCheckinDate.getTime() === prevDay.getTime();
    const newStreak = consecutive ? streak!.checkinStreak + 1 : 1;
    const reward = BigInt(checkinReward(newStreak));

    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId, contextType: 'GLOBAL', contextId: null },
    });
    const newBal = wallet.balance + reward;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
    await tx.pointLedger.create({
      data: {
        userId, contextType: 'GLOBAL', type: 'DAILY',
        amount: reward, balanceAfter: newBal, refType: 'USER', refId: userId,
      },
    });

    await tx.streak.upsert({
      where: { userId },
      create: { userId, checkinStreak: 1, winStreak: 0, lastCheckinDate: dayStart },
      update: { checkinStreak: newStreak, lastCheckinDate: dayStart },
    });

    return { balance: newBal, reward, streak: newStreak };
  });
}
