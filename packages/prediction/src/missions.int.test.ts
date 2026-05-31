import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeBet, settleMatch } from './prediction-service';
import { listMissions, claimMission, ensureMissions } from './missions';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.missionProgress.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.matchOdds.deleteMany();
  await prisma.match.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('missions (integration · Postgres)', () => {
  let userId: bigint;
  // "now" = a stable point during the UTC+7 day of 2026-06-01
  // UTC+7 2026-06-01 10:00 => UTC 2026-06-01T03:00:00Z
  const now = new Date('2026-06-01T03:00:00.000Z');

  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: 'mission@test.io', passwordHash: 'x' } });
    userId = user.id;
    await prisma.wallet.create({ data: { userId, contextType: 'GLOBAL', balance: 5000n } });

    await ensureMissions(prisma);
  });

  it('ensureMissions is idempotent — second call does not throw or duplicate rows', async () => {
    await ensureMissions(prisma);
    const count = await prisma.mission.count();
    expect(count).toBe(3);
  });

  it('PLACE_3: listMissions shows 0 progress before any bets', async () => {
    const list = await listMissions(prisma, userId, now);
    const place3 = list.find((m) => m.code === 'PLACE_3')!;
    expect(place3.progress).toBe(0);
    expect(place3.complete).toBe(false);
    expect(place3.claimed).toBe(false);
  });

  it('PLACE_3: place 3 bets → progress = 3, complete = true', async () => {
    // kickoffAt is in the future; createdAt will be the insert time (now in test runner)
    // We need the predictions to fall within today's UTC+7 window.
    // The window start for our "now" (2026-06-01T03:00:00Z) = 2026-05-31T17:00:00Z
    // Any prediction inserted during this test runs within that range.

    const futureKickoff = new Date(now.getTime() + 3_600_000); // 1h after our test "now"

    // Create 3 separate matches + place bets on each
    for (let i = 0; i < 3; i++) {
      const match = await prisma.match.create({
        data: {
          round: 'GROUP',
          homeTeamId: BigInt(10 + i),
          awayTeamId: BigInt(20 + i),
          kickoffAt: futureKickoff,
          status: 'SCHEDULED',
        },
      });
      await prisma.matchOdds.create({
        data: { matchId: match.id, mHome: 1.5, mDraw: 1.1, mAway: 1.8, source: 'API' },
      });
      await placeBet(prisma, { userId, matchId: match.id, pick: '1', stake: 10n });
    }

    // Use the REAL now (bets were just created) so the window covers these new rows
    const realNow = new Date();
    const list = await listMissions(prisma, userId, realNow);
    const place3 = list.find((m) => m.code === 'PLACE_3')!;
    expect(place3.progress).toBeGreaterThanOrEqual(3);
    expect(place3.complete).toBe(true);
  });

  it('PLACE_3: claimMission credits +100 and writes a BONUS ledger row', async () => {
    const walletBefore = await prisma.wallet.findFirstOrThrow({ where: { userId, contextType: 'GLOBAL' } });
    const realNow = new Date();
    const { reward, balance } = await claimMission(prisma, userId, 'PLACE_3', realNow);

    expect(reward).toBe(100);
    expect(balance).toBe(walletBefore.balance + 100n);

    const walletAfter = await prisma.wallet.findFirstOrThrow({ where: { userId, contextType: 'GLOBAL' } });
    expect(walletAfter.balance).toBe(walletBefore.balance + 100n);

    const ledger = await prisma.pointLedger.findFirst({
      where: { userId, type: 'BONUS' },
      orderBy: { id: 'desc' },
    });
    expect(ledger).not.toBeNull();
    expect(ledger!.amount).toBe(100n);
    expect(ledger!.balanceAfter).toBe(walletBefore.balance + 100n);
    expect(ledger!.refType).toBe('MISSION');
  });

  it('PLACE_3: second claimMission throws ALREADY_CLAIMED and wallet is unchanged', async () => {
    const walletBefore = await prisma.wallet.findFirstOrThrow({ where: { userId, contextType: 'GLOBAL' } });
    const realNow = new Date();
    await expect(claimMission(prisma, userId, 'PLACE_3', realNow)).rejects.toThrow('ALREADY_CLAIMED');

    const walletAfter = await prisma.wallet.findFirstOrThrow({ where: { userId, contextType: 'GLOBAL' } });
    expect(walletAfter.balance).toBe(walletBefore.balance);
  });

  it('UNDERDOG: 0 progress before an underdog bet', async () => {
    const realNow = new Date();
    const list = await listMissions(prisma, userId, realNow);
    const underdog = list.find((m) => m.code === 'UNDERDOG')!;
    // none of the 3 earlier bets had odds >= 2.0 (home odds were 1.5)
    expect(underdog.complete).toBe(false);
  });

  it('WIN_1: claimMission throws NOT_COMPLETE before winning a settled bet', async () => {
    const realNow = new Date();
    await expect(claimMission(prisma, userId, 'WIN_1', realNow)).rejects.toThrow('NOT_COMPLETE');
  });
});
