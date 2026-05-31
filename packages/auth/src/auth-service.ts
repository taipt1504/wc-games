/**
 * @wc/auth — Account service (register / login / daily check-in).
 * Source of truth: PRD §03 (Auth) + §04 (signup 1000, daily 200, UTC+7) + §16.
 * Password hashing: bcryptjs (pure JS). JWT/cookie handling lives in the web API layer.
 */
import type { PrismaClient } from '@wc/db';
import bcrypt from 'bcryptjs';
import { checkinReward } from '@wc/core';

const SIGNUP_BONUS = 1000n;
const REFERRAL_BONUS = 300n;
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
      create: { userId, checkinStreak: newStreak, winStreak: 0, lastCheckinDate: dayStart },
      update: { checkinStreak: newStreak, lastCheckinDate: dayStart },
    });

    return { balance: newBal, reward, streak: newStreak };
  });
}

/** Returns the user's referral code, creating one if absent. Code is base36(userId) for uniqueness. */
export async function getOrCreateReferralCode(prisma: PrismaClient, userId: bigint): Promise<string> {
  const existing = await prisma.referralCode.findUnique({ where: { userId } });
  if (existing) return existing.code;
  const code = userId.toString(36);
  await prisma.referralCode.create({ data: { userId, code } });
  return code;
}

/**
 * Redeem a referral code for a new user.
 * Idempotent: unknown code / self-referral / already-referred referee → {awarded:false}.
 * On success: creates Referral(ACTIVATED) + credits both users REFERRAL_BONUS in one transaction.
 */
export async function redeemReferral(
  prisma: PrismaClient,
  refereeId: bigint,
  code: string,
): Promise<{ awarded: boolean }> {
  const refCode = await prisma.referralCode.findUnique({ where: { code } });
  if (!refCode) return { awarded: false };
  const referrerId = refCode.userId;
  if (referrerId === refereeId) return { awarded: false };
  const existing = await prisma.referral.findUnique({ where: { refereeId } });
  if (existing) return { awarded: false };

  await prisma.$transaction(async (tx) => {
    const referral = await tx.referral.create({
      data: { referrerId, refereeId, status: 'ACTIVATED' },
    });

    // Credit referrer
    const referrerWallet = await tx.wallet.findFirstOrThrow({
      where: { userId: referrerId, contextType: 'GLOBAL', contextId: null },
    });
    const referrerNewBal = referrerWallet.balance + REFERRAL_BONUS;
    await tx.wallet.update({ where: { id: referrerWallet.id }, data: { balance: referrerNewBal } });
    await tx.pointLedger.create({
      data: {
        userId: referrerId, contextType: 'GLOBAL', type: 'REFERRAL',
        amount: REFERRAL_BONUS, balanceAfter: referrerNewBal, refType: 'REFERRAL', refId: referral.id,
      },
    });

    // Credit referee
    const refereeWallet = await tx.wallet.findFirstOrThrow({
      where: { userId: refereeId, contextType: 'GLOBAL', contextId: null },
    });
    const refereeNewBal = refereeWallet.balance + REFERRAL_BONUS;
    await tx.wallet.update({ where: { id: refereeWallet.id }, data: { balance: refereeNewBal } });
    await tx.pointLedger.create({
      data: {
        userId: refereeId, contextType: 'GLOBAL', type: 'REFERRAL',
        amount: REFERRAL_BONUS, balanceAfter: refereeNewBal, refType: 'REFERRAL', refId: referral.id,
      },
    });
  });

  return { awarded: true };
}

// ─────────────────────────── NOTIFICATION PREFERENCES ───────────────────────────

/** All notification types the UI exposes. Delivery (PUSH/email) is intentionally deferred. */
export const NOTIFICATION_TYPES = ['betLock', 'results', 'streakAtRisk', 'lobbyAlerts', 'news'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type NotificationPrefs = Record<NotificationType, boolean>;

/** The single channel stored per type (delivery infra deferred). */
const CHANNEL = 'PUSH';

/** Build a full-on defaults map. */
function defaultPrefs(): NotificationPrefs {
  return Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, true])) as NotificationPrefs;
}

/**
 * Returns the user's notification preference map, creating missing rows
 * (all enabled by default) if absent.
 */
export async function getNotificationPrefs(
  prisma: PrismaClient,
  userId: bigint,
): Promise<NotificationPrefs> {
  // Upsert any missing rows with default enabled=true
  await Promise.all(
    NOTIFICATION_TYPES.map((type) =>
      prisma.notificationPref.upsert({
        where: { userId_type_channel: { userId, type, channel: CHANNEL } },
        create: { userId, type, channel: CHANNEL, enabled: true },
        update: {}, // don't overwrite if already present
      }),
    ),
  );
  const rows = await prisma.notificationPref.findMany({
    where: { userId, channel: CHANNEL },
  });
  const prefs = defaultPrefs();
  for (const row of rows) {
    if (NOTIFICATION_TYPES.includes(row.type as NotificationType)) {
      prefs[row.type as NotificationType] = row.enabled;
    }
  }
  return prefs;
}

/**
 * Updates the user's notification preferences, patching only the provided flags.
 * Returns the full updated preference map.
 */
export async function updateNotificationPrefs(
  prisma: PrismaClient,
  userId: bigint,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  const updates = (Object.entries(patch) as [NotificationType, boolean][]).filter(([type]) =>
    NOTIFICATION_TYPES.includes(type),
  );
  await Promise.all(
    updates.map(([type, enabled]) =>
      prisma.notificationPref.upsert({
        where: { userId_type_channel: { userId, type, channel: CHANNEL } },
        create: { userId, type, channel: CHANNEL, enabled },
        update: { enabled },
      }),
    ),
  );
  return getNotificationPrefs(prisma, userId);
}

/** Returns the user's referral code and count of ACTIVATED referrals where they are the referrer. */
export async function referralStats(
  prisma: PrismaClient,
  userId: bigint,
): Promise<{ code: string; count: number }> {
  const code = await getOrCreateReferralCode(prisma, userId);
  const count = await prisma.referral.count({ where: { referrerId: userId, status: 'ACTIVATED' } });
  return { code, count };
}
