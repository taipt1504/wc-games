import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { registerUser, verifyLogin, dailyCheckin } from './auth-service';

const prisma = new PrismaClient();

async function clean() {
  // FK-safe order: clear predictions (-> user FK) before users on the shared test DB
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.streak.deleteMany();
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
