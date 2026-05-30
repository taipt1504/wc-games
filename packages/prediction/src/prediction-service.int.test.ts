import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeBet, settleMatch } from './prediction-service';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.matchOdds.deleteMany();
  await prisma.match.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('prediction-service (integration · Postgres)', () => {
  let userId: bigint;
  let matchId: bigint;

  it('placeBet escrows stake, opens prediction, writes STAKE ledger', async () => {
    const user = await prisma.user.create({ data: { email: 'p1@test.io', passwordHash: 'x' } });
    userId = user.id;
    await prisma.wallet.create({ data: { userId, contextType: 'GLOBAL', balance: 1000n } });
    const match = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 1n, awayTeamId: 2n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    matchId = match.id;
    await prisma.matchOdds.create({ data: { matchId, mHome: 0.8, mDraw: 1.1, mAway: 1.5, source: 'API' } });

    const pred = await placeBet(prisma, { userId, matchId, pick: '1', stake: 100n });
    expect(pred.status).toBe('OPEN');
    expect(pred.outcome).toBe('HOME');

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId } });
    expect(wallet.balance).toBe(900n); // 1000 - 100 escrow

    const ledger = await prisma.pointLedger.findMany({ where: { userId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('STAKE');
    expect(ledger[0].amount).toBe(-100n);
    expect(ledger[0].balanceAfter).toBe(900n);
  });

  it('rejects a bet on a locked (kicked-off) match', async () => {
    const locked = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 3n, awayTeamId: 4n, kickoffAt: new Date(Date.now() - 60_000), status: 'SCHEDULED' },
    });
    await prisma.matchOdds.create({ data: { matchId: locked.id, mHome: 1, mDraw: 1, mAway: 1, source: 'API' } });
    await expect(placeBet(prisma, { userId, matchId: locked.id, pick: '1', stake: 50n })).rejects.toThrow('BET_LOCKED');
  });

  it('settleMatch pays winner (1.8x), updates ROI stats, and is idempotent', async () => {
    // HOME win 2-1, pick HOME @ 0.8 -> payout 180
    const r1 = await settleMatch(prisma, matchId, { home: 2, away: 1 });
    expect(r1.alreadySettled).toBe(false);
    expect(r1.result).toBe('HOME');

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId } });
    expect(wallet.balance).toBe(1080n); // 900 + 180

    const pred = await prisma.prediction.findFirstOrThrow({ where: { matchId } });
    expect(pred.status).toBe('WON');
    expect(pred.payout).toBe(180n);

    const stats = await prisma.predictionUserStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.settledCount).toBe(1);
    expect(stats.winCount).toBe(1);
    expect(stats.totalStaked).toBe(100n);
    expect(stats.totalReturned).toBe(180n);

    const settleLedger = await prisma.pointLedger.findMany({ where: { userId, type: 'SETTLE' } });
    expect(settleLedger).toHaveLength(1);
    expect(settleLedger[0].amount).toBe(180n);

    // re-run settle -> idempotent, no double credit
    const r2 = await settleMatch(prisma, matchId, { home: 2, away: 1 });
    expect(r2.alreadySettled).toBe(true);
    const wallet2 = await prisma.wallet.findFirstOrThrow({ where: { userId } });
    expect(wallet2.balance).toBe(1080n);
  });
});
