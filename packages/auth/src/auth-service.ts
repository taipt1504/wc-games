/**
 * @wc/auth — Account service (register / login / daily check-in).
 * Source of truth: PRD §03 (Auth) + §04 (signup 1000, daily 200, UTC+7) + §16.
 * Password hashing: bcryptjs (pure JS). JWT/cookie handling lives in the web API layer.
 */
import type { PrismaClient } from '@wc/db';
import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'node:crypto';
import { checkinReward } from '@wc/core';

/** SHA-256 hex digest of a string. Used for hashing password-reset tokens at rest. */
function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

const SIGNUP_BONUS = 1000n;
const REFERRAL_BONUS = 300n;
const TZ_OFFSET_MS = 7 * 3600 * 1000; // UTC+7 (PRD OQ-07)
const BCRYPT_ROUNDS = 10;

export interface SessionUser {
  id: bigint;
  email: string;
  role: string;
}

/** Generic secret hashing (e.g. lobby join passwords) — bcrypt, same policy as user passwords. */
export async function hashSecret(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
export async function verifySecret(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
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

// ─────────────────────────── PASSWORD CHANGE & RESET (AUTH-06 / AUTH-08) ───────────────────────────

/**
 * AUTH-06: Change password for an authenticated user.
 * Throws 'INVALID_CREDENTIALS' if currentPassword doesn't match, 'WEAK_PASSWORD' if newPassword < 8 chars.
 */
export async function changePassword(
  prisma: PrismaClient,
  userId: bigint,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true }> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw new Error('INVALID_CREDENTIALS');
  if (newPassword.length < 8) throw new Error('WEAK_PASSWORD');
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { ok: true };
}

/**
 * AUTH-08: Request a password reset token for an email.
 * Always returns { ok: true } to avoid account enumeration.
 * NOTE: Email delivery is deferred infra — the reset token is returned directly in the response
 * (dev/no-email mode). In production with SMTP, remove 'token' from the return value.
 * If the email has no associated account, returns { ok: true } with no token.
 */
export async function requestPasswordReset(
  prisma: PrismaClient,
  email: string,
): Promise<{ ok: true; token?: string }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: true };
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  await prisma.passwordReset.create({
    data: { userId: user.id, tokenHash: sha256(token), expiresAt },
  });
  return { ok: true, token };
}

/**
 * AUTH-08: Consume a password-reset token and set a new password.
 * Throws 'INVALID_TOKEN' if token is unknown, already used, or expired.
 * Throws 'WEAK_PASSWORD' if newPassword < 8 chars.
 * The raw token is passed in; it is hashed internally before lookup.
 */
export async function resetPassword(
  prisma: PrismaClient,
  token: string,
  newPassword: string,
): Promise<{ ok: true }> {
  const tokenHash = sha256(token);
  const pr = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!pr || pr.usedAt != null || pr.expiresAt < new Date()) throw new Error('INVALID_TOKEN');
  if (newPassword.length < 8) throw new Error('WEAK_PASSWORD');
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: pr.userId }, data: { passwordHash } }),
    prisma.passwordReset.update({ where: { id: pr.id }, data: { usedAt: new Date() } }),
  ]);
  return { ok: true };
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

// ─────────────────────────── OAUTH + REFRESH SESSIONS (AUTH design UC-02 / §7) ───────────────────────────

const REFRESH_TTL_MS = 30 * DAY_MS; // 30d, mirrors the refresh cookie lifetime

/** sha256 hex of a refresh token. Tokens are stored hashed at rest; never persist the raw value. */
export function hashToken(raw: string): string {
  return sha256(raw);
}

/**
 * Find a user by email, or create one for OAuth sign-in (Google).
 * Existing email → linked (logged in). New email → created with an unusable random password
 * (set one later via reset) + GLOBAL wallet 1000 + SIGNUP ledger, mirroring registerUser.
 * Throws 'BANNED' for a banned account.
 */
export async function findOrCreateOAuthUser(
  prisma: PrismaClient,
  input: { email: string; username?: string },
): Promise<SessionUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    if (existing.status === 'BANNED') throw new Error('BANNED');
    return { id: existing.id, email: existing.email, role: existing.role };
  }
  const passwordHash = await bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
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

/** Persist a new refresh session row (login/register/oauth). Caller stores the raw token in a cookie. */
export async function createAuthSession(
  prisma: PrismaClient,
  userId: bigint,
  refreshTokenHash: string,
  ip: string | null,
  userAgent: string | null,
  now: Date = new Date(),
): Promise<void> {
  await prisma.authSession.create({
    data: { userId, refreshTokenHash, ip, userAgent, expiresAt: new Date(now.getTime() + REFRESH_TTL_MS) },
  });
}

/**
 * Rotate a refresh token: revoke the presented session and issue a new one.
 * Throws 'INVALID_REFRESH' (unknown/expired), 'BANNED', or 'REFRESH_REUSE' — a replay of an
 * already-revoked token revokes the user's whole session family (theft response, PRD §7).
 */
export async function rotateRefresh(
  prisma: PrismaClient,
  oldRefreshTokenHash: string,
  newRefreshTokenHash: string,
  ip: string | null,
  userAgent: string | null,
  now: Date = new Date(),
): Promise<SessionUser> {
  const session = await prisma.authSession.findFirst({ where: { refreshTokenHash: oldRefreshTokenHash } });
  if (!session) throw new Error('INVALID_REFRESH');
  if (session.revokedAt) {
    await prisma.authSession.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: now } });
    throw new Error('REFRESH_REUSE');
  }
  if (session.expiresAt < now) throw new Error('INVALID_REFRESH');
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) throw new Error('INVALID_REFRESH');
  if (user.status === 'BANNED') throw new Error('BANNED');
  await prisma.$transaction([
    prisma.authSession.update({ where: { id: session.id }, data: { revokedAt: now } }),
    prisma.authSession.create({
      data: { userId: session.userId, refreshTokenHash: newRefreshTokenHash, ip, userAgent, expiresAt: new Date(now.getTime() + REFRESH_TTL_MS) },
    }),
  ]);
  return { id: user.id, email: user.email, role: user.role };
}

/** Revoke the live session matching this refresh-token hash (logout). No-op if absent. */
export async function revokeSession(
  prisma: PrismaClient,
  refreshTokenHash: string,
  now: Date = new Date(),
): Promise<void> {
  await prisma.authSession.updateMany({ where: { refreshTokenHash, revokedAt: null }, data: { revokedAt: now } });
}
