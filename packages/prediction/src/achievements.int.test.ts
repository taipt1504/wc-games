import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeBet, settleMatch } from './prediction-service';
import { listAchievements, ensureAchievements } from './achievements';

const prisma = new PrismaClient();

async function clean() {
  await prisma.userAchievement.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.matchOdds.deleteMany();
  await prisma.match.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('achievements (integration · Postgres)', () => {
  it('ensureAchievements is idempotent — second call does not duplicate rows', async () => {
    await ensureAchievements(prisma);
    await ensureAchievements(prisma);
    const count = await prisma.achievement.count();
    expect(count).toBe(5);
  });

  it('fresh user — all achievements locked', async () => {
    const user = await prisma.user.create({ data: { email: 'fresh@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: 0n } });

    const list = await listAchievements(prisma, user.id);
    expect(list.every((a) => !a.unlocked)).toBe(true);
    expect(list.every((a) => a.progress === 0)).toBe(true);

    // No UserAchievement rows persisted
    const persisted = await prisma.userAchievement.findMany({ where: { userId: user.id } });
    expect(persisted).toHaveLength(0);
  });

  it('FIRST_BLOOD: user with a WON bet → unlocked + UserAchievement row persisted', async () => {
    const user = await prisma.user.create({ data: { email: 'firstblood@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: 1000n } });

    const futureKickoff = new Date(Date.now() + 3_600_000);
    const match = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 100n, awayTeamId: 101n, kickoffAt: futureKickoff, status: 'SCHEDULED' },
    });
    await prisma.matchOdds.create({
      data: { matchId: match.id, mHome: 1.8, mDraw: 3.0, mAway: 4.5, source: 'API' },
    });
    await placeBet(prisma, { userId: user.id, matchId: match.id, pick: '1', stake: 100n });
    await settleMatch(prisma, match.id, { home: 1, away: 0 });

    const list = await listAchievements(prisma, user.id);
    const fb = list.find((a) => a.code === 'FIRST_BLOOD')!;
    expect(fb.unlocked).toBe(true);
    expect(fb.progress).toBe(1);

    // UserAchievement row should be persisted
    const codeToId = await ensureAchievements(prisma);
    const row = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: user.id, achievementId: codeToId.get('FIRST_BLOOD')! } },
    });
    expect(row).not.toBeNull();
    expect(row!.userId).toBe(user.id);
  });

  it('FIRST_BLOOD: second call is idempotent (no duplicate UserAchievement)', async () => {
    // Reuse the firstblood user — find by email
    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'firstblood@test.io' } });
    await listAchievements(prisma, user.id);
    const rows = await prisma.userAchievement.findMany({ where: { userId: user.id } });
    // Should still have exactly 1 FIRST_BLOOD row (and possibly others but not duplicates)
    const codeToId = await ensureAchievements(prisma);
    const fbRows = rows.filter((r) => r.achievementId === codeToId.get('FIRST_BLOOD'));
    expect(fbRows).toHaveLength(1);
  });

  it('GIANT_KILLER: WON bet at odds 2.5 → unlocked', async () => {
    const user = await prisma.user.create({ data: { email: 'giantkiller@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: 1000n } });

    const futureKickoff = new Date(Date.now() + 3_600_000);
    const match = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 200n, awayTeamId: 201n, kickoffAt: futureKickoff, status: 'SCHEDULED' },
    });
    await prisma.matchOdds.create({
      data: { matchId: match.id, mHome: 2.5, mDraw: 3.0, mAway: 4.5, source: 'API' },
    });
    await placeBet(prisma, { userId: user.id, matchId: match.id, pick: '1', stake: 100n });
    await settleMatch(prisma, match.id, { home: 1, away: 0 });

    const list = await listAchievements(prisma, user.id);
    const gk = list.find((a) => a.code === 'GIANT_KILLER')!;
    expect(gk.unlocked).toBe(true);

    const codeToId = await ensureAchievements(prisma);
    const row = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: user.id, achievementId: codeToId.get('GIANT_KILLER')! } },
    });
    expect(row).not.toBeNull();
  });

  it('MILLIONAIRE: wallet balance 10000 → unlocked', async () => {
    const user = await prisma.user.create({ data: { email: 'millionaire@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: 10000n } });

    const list = await listAchievements(prisma, user.id);
    const mil = list.find((a) => a.code === 'MILLIONAIRE')!;
    expect(mil.unlocked).toBe(true);
    expect(mil.progress).toBe(10000);

    const codeToId = await ensureAchievements(prisma);
    const row = await prisma.userAchievement.findUnique({
      where: { userId_achievementId: { userId: user.id, achievementId: codeToId.get('MILLIONAIRE')! } },
    });
    expect(row).not.toBeNull();
  });

  it('MILLIONAIRE: wallet balance 9999 → locked with correct progress', async () => {
    const user = await prisma.user.create({ data: { email: 'almost@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: 9999n } });

    const list = await listAchievements(prisma, user.id);
    const mil = list.find((a) => a.code === 'MILLIONAIRE')!;
    expect(mil.unlocked).toBe(false);
    expect(mil.progress).toBe(9999);
  });

  it('HOT_STREAK: 5 consecutive wins → unlocked', async () => {
    const user = await prisma.user.create({ data: { email: 'hotstreak@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance: 5000n } });

    const futureKickoff = new Date(Date.now() + 3_600_000);
    for (let i = 0; i < 5; i++) {
      const match = await prisma.match.create({
        data: { round: 'GROUP', homeTeamId: BigInt(300 + i), awayTeamId: BigInt(400 + i), kickoffAt: futureKickoff, status: 'SCHEDULED' },
      });
      await prisma.matchOdds.create({
        data: { matchId: match.id, mHome: 1.5, mDraw: 3.0, mAway: 4.0, source: 'API' },
      });
      await placeBet(prisma, { userId: user.id, matchId: match.id, pick: '1', stake: 100n });
      await settleMatch(prisma, match.id, { home: 1, away: 0 });
    }

    const list = await listAchievements(prisma, user.id);
    const hs = list.find((a) => a.code === 'HOT_STREAK')!;
    expect(hs.unlocked).toBe(true);
    expect(hs.progress).toBeGreaterThanOrEqual(5);
  });
});
