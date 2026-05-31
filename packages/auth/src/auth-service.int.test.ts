import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { registerUser, verifyLogin, dailyCheckin, getOrCreateReferralCode, redeemReferral, referralStats, getNotificationPrefs, updateNotificationPrefs, NOTIFICATION_TYPES, changePassword, requestPasswordReset, resetPassword } from './auth-service';

const prisma = new PrismaClient();

async function clean() {
  // FK-safe order
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.notificationPref.deleteMany();
  await prisma.passwordReset.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('auth-service (integration · Postgres)', () => {
  it('registerUser creates user + 1000 GLOBAL wallet + SIGNUP ledger', async () => {
    const u = await registerUser(prisma, { email: 'a@test.io', username: 'alexr', password: 'pw123456' });
    expect(u.email).toBe('a@test.io');
    const w = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(w.balance).toBe(1000n);
    const led = await prisma.pointLedger.findMany({ where: { userId: u.id } });
    expect(led).toHaveLength(1);
    expect(led[0].type).toBe('SIGNUP');
    expect(led[0].amount).toBe(1000n);
  });

  it('rejects a duplicate email', async () => {
    await expect(registerUser(prisma, { email: 'a@test.io', password: 'whatever' })).rejects.toThrow('EMAIL_TAKEN');
  });

  it('verifyLogin: correct password returns session user, wrong throws', async () => {
    const ok = await verifyLogin(prisma, { email: 'a@test.io', password: 'pw123456' });
    expect(ok.email).toBe('a@test.io');
    await expect(verifyLogin(prisma, { email: 'a@test.io', password: 'wrong' })).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('dailyCheckin: streak 1 → reward 200; same-day repeat rejected', async () => {
    const u = await prisma.user.findFirstOrThrow({ where: { email: 'a@test.io' } });
    const now = new Date('2026-06-13T05:00:00Z'); // noon in UTC+7
    const r = await dailyCheckin(prisma, u.id, now);
    expect(r.reward).toBe(200n);
    expect(r.streak).toBe(1);
    expect(r.balance).toBe(1200n);
    await expect(dailyCheckin(prisma, u.id, now)).rejects.toThrow('ALREADY_CHECKED_IN');
  });

  it('allows check-in again on the next UTC+7 day (streak 2 → reward 200)', async () => {
    const u = await prisma.user.findFirstOrThrow({ where: { email: 'a@test.io' } });
    const nextDay = new Date('2026-06-14T05:00:00Z');
    const r = await dailyCheckin(prisma, u.id, nextDay);
    expect(r.reward).toBe(200n);
    expect(r.streak).toBe(2);
    expect(r.balance).toBe(1400n);
  });

  it('third consecutive day: streak 3 → reward 250', async () => {
    const u = await prisma.user.findFirstOrThrow({ where: { email: 'a@test.io' } });
    const day3 = new Date('2026-06-15T05:00:00Z');
    const r = await dailyCheckin(prisma, u.id, day3);
    expect(r.reward).toBe(250n);
    expect(r.streak).toBe(3);
    expect(r.balance).toBe(1650n);
  });
});

describe('referral (integration · Postgres)', () => {
  let referrerId: bigint;
  let refereeId: bigint;
  let code: string;

  it('setup: create referrer + referee users', async () => {
    const referrer = await registerUser(prisma, { email: 'referrer@test.io', username: 'referrer1', password: 'pw123456' });
    const referee = await registerUser(prisma, { email: 'referee@test.io', username: 'referee1', password: 'pw123456' });
    referrerId = referrer.id;
    refereeId = referee.id;
  });

  it('getOrCreateReferralCode: creates a code on first call, returns same on second', async () => {
    code = await getOrCreateReferralCode(prisma, referrerId);
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
    // idempotent
    const again = await getOrCreateReferralCode(prisma, referrerId);
    expect(again).toBe(code);
  });

  it('redeemReferral: credits both users +300 and creates ACTIVATED referral', async () => {
    const result = await redeemReferral(prisma, refereeId, code);
    expect(result.awarded).toBe(true);

    // referrer wallet: 1000 (signup) + 300 = 1300
    const referrerWallet = await prisma.wallet.findFirstOrThrow({ where: { userId: referrerId, contextType: 'GLOBAL', contextId: null } });
    expect(referrerWallet.balance).toBe(1300n);

    // referee wallet: 1000 (signup) + 300 = 1300
    const refereeWallet = await prisma.wallet.findFirstOrThrow({ where: { userId: refereeId, contextType: 'GLOBAL', contextId: null } });
    expect(refereeWallet.balance).toBe(1300n);

    // ACTIVATED referral row exists
    const referral = await prisma.referral.findUnique({ where: { refereeId } });
    expect(referral).not.toBeNull();
    expect(referral!.status).toBe('ACTIVATED');
    expect(referral!.referrerId).toBe(referrerId);
  });

  it('referralStats: count === 1 after one successful referral', async () => {
    const stats = await referralStats(prisma, referrerId);
    expect(stats.code).toBe(code);
    expect(stats.count).toBe(1);
  });

  it('redeemReferral: second attempt by same referee returns {awarded:false} with no double credit', async () => {
    const result = await redeemReferral(prisma, refereeId, code);
    expect(result.awarded).toBe(false);

    // balances unchanged from previous test
    const referrerWallet = await prisma.wallet.findFirstOrThrow({ where: { userId: referrerId, contextType: 'GLOBAL', contextId: null } });
    expect(referrerWallet.balance).toBe(1300n);

    const refereeWallet = await prisma.wallet.findFirstOrThrow({ where: { userId: refereeId, contextType: 'GLOBAL', contextId: null } });
    expect(refereeWallet.balance).toBe(1300n);
  });

  it('redeemReferral: unknown code returns {awarded:false}', async () => {
    const result = await redeemReferral(prisma, refereeId, 'zzzzunknown');
    expect(result.awarded).toBe(false);
  });

  it('redeemReferral: self-referral returns {awarded:false}', async () => {
    const result = await redeemReferral(prisma, referrerId, code);
    expect(result.awarded).toBe(false);
  });
});

describe('notification prefs (integration · Postgres)', () => {
  let userId: bigint;

  it('setup: create a fresh user', async () => {
    const u = await registerUser(prisma, { email: 'notifpref@test.io', password: 'pw123456' });
    userId = u.id;
  });

  it('getNotificationPrefs: creates all defaults (all enabled) for a new user', async () => {
    const prefs = await getNotificationPrefs(prisma, userId);
    for (const type of NOTIFICATION_TYPES) {
      expect(prefs[type]).toBe(true);
    }
    // All types are present
    expect(Object.keys(prefs).sort()).toEqual([...NOTIFICATION_TYPES].sort());
    // Verify rows were actually persisted in DB
    const rows = await prisma.notificationPref.findMany({ where: { userId } });
    expect(rows).toHaveLength(NOTIFICATION_TYPES.length);
  });

  it('getNotificationPrefs: idempotent — second call returns same defaults', async () => {
    const prefs = await getNotificationPrefs(prisma, userId);
    for (const type of NOTIFICATION_TYPES) {
      expect(prefs[type]).toBe(true);
    }
  });

  it('updateNotificationPrefs: flips a flag and persists', async () => {
    const updated = await updateNotificationPrefs(prisma, userId, { news: false });
    expect(updated.news).toBe(false);
    // Other flags unchanged
    expect(updated.betLock).toBe(true);
    expect(updated.results).toBe(true);
  });

  it('getNotificationPrefs: reflects the persisted flip', async () => {
    const prefs = await getNotificationPrefs(prisma, userId);
    expect(prefs.news).toBe(false);
    expect(prefs.betLock).toBe(true);
  });

  it('updateNotificationPrefs: patch multiple flags at once', async () => {
    const updated = await updateNotificationPrefs(prisma, userId, { betLock: false, streakAtRisk: false });
    expect(updated.betLock).toBe(false);
    expect(updated.streakAtRisk).toBe(false);
    expect(updated.results).toBe(true);
    expect(updated.lobbyAlerts).toBe(true);
  });
});

describe('changePassword (integration · Postgres)', () => {
  let userId: bigint;
  const initPassword = 'initPass99';

  it('setup: create user for changePassword tests', async () => {
    const u = await registerUser(prisma, { email: 'changepw@test.io', password: initPassword });
    userId = u.id;
  });

  it('wrong current password throws INVALID_CREDENTIALS', async () => {
    await expect(changePassword(prisma, userId, 'wrongPass', 'newPass99')).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('new password shorter than 8 chars throws WEAK_PASSWORD', async () => {
    await expect(changePassword(prisma, userId, initPassword, 'short')).rejects.toThrow('WEAK_PASSWORD');
  });

  it('correct current password and valid new password succeeds', async () => {
    const result = await changePassword(prisma, userId, initPassword, 'newSecure99');
    expect(result).toEqual({ ok: true });
  });

  it('verifyLogin works with new password after change', async () => {
    const u = await verifyLogin(prisma, { email: 'changepw@test.io', password: 'newSecure99' });
    expect(u.email).toBe('changepw@test.io');
  });

  it('verifyLogin fails with old password after change', async () => {
    await expect(verifyLogin(prisma, { email: 'changepw@test.io', password: initPassword })).rejects.toThrow('INVALID_CREDENTIALS');
  });
});

describe('password reset flow (integration · Postgres)', () => {
  let resetToken: string;

  it('setup: create user for reset tests', async () => {
    await registerUser(prisma, { email: 'resetpw@test.io', password: 'oldPass99' });
  });

  it('requestPasswordReset returns a token for a known email', async () => {
    const result = await requestPasswordReset(prisma, 'resetpw@test.io');
    expect(result.ok).toBe(true);
    expect(typeof result.token).toBe('string');
    expect(result.token!.length).toBeGreaterThan(0);
    resetToken = result.token!;
  });

  it('requestPasswordReset returns ok:true with no token for an unknown email (no enumeration)', async () => {
    const result = await requestPasswordReset(prisma, 'nobody@nowhere.io');
    expect(result.ok).toBe(true);
    expect(result.token).toBeUndefined();
  });

  it('resetPassword succeeds and verifyLogin works with new password', async () => {
    const result = await resetPassword(prisma, resetToken, 'brandNew99');
    expect(result).toEqual({ ok: true });
    const u = await verifyLogin(prisma, { email: 'resetpw@test.io', password: 'brandNew99' });
    expect(u.email).toBe('resetpw@test.io');
  });

  it('verifyLogin fails with old password after reset', async () => {
    await expect(verifyLogin(prisma, { email: 'resetpw@test.io', password: 'oldPass99' })).rejects.toThrow('INVALID_CREDENTIALS');
  });

  it('reusing the same token throws INVALID_TOKEN (token is single-use)', async () => {
    await expect(resetPassword(prisma, resetToken, 'anotherPass99')).rejects.toThrow('INVALID_TOKEN');
  });

  it('unknown token throws INVALID_TOKEN', async () => {
    await expect(resetPassword(prisma, 'deadbeef'.repeat(8), 'anotherPass99')).rejects.toThrow('INVALID_TOKEN');
  });
});
