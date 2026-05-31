import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeBet, settleMatch, resettleMatch } from './prediction-service';

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

  it('resettleMatch reverses the prior payout and re-applies a corrected score (ADMIN-04)', async () => {
    // was HOME 2-1 (pick HOME won, +180). Admin corrects to AWAY 1-2 -> the HOME pick now loses.
    const r = await resettleMatch(prisma, matchId, { home: 1, away: 2 });
    expect(r.reversed).toBe(1);
    expect(r.result).toBe('AWAY');

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId } });
    expect(wallet.balance).toBe(900n); // 180 clawed back; losing pick pays nothing

    const pred = await prisma.prediction.findFirstOrThrow({ where: { matchId } });
    expect(pred.status).toBe('LOST');
    expect(pred.payout).toBe(0n);

    const stats = await prisma.predictionUserStats.findUniqueOrThrow({ where: { userId } });
    expect(stats.settledCount).toBe(1); // reversed (-1) then re-settled (+1)
    expect(stats.winCount).toBe(0);
    expect(stats.totalReturned).toBe(0n);
    expect(stats.totalStaked).toBe(100n);

    // ledger trail: original +180, reversal -180, corrected settle 0
    const settleLedger = await prisma.pointLedger.findMany({ where: { userId, type: 'SETTLE' }, orderBy: { id: 'asc' } });
    expect(settleLedger.map((l) => l.amount)).toEqual([180n, -180n, 0n]);

    // and re-running with the same corrected score is idempotent (settlement now DONE)
    const again = await resettleMatch(prisma, matchId, { home: 1, away: 2 });
    expect(again.reversed).toBe(1);
    const wallet2 = await prisma.wallet.findFirstOrThrow({ where: { userId } });
    expect(wallet2.balance).toBe(900n);
  });

  it('underdog bonus: HOME win at mHome=2.5, stake=100 → payout 403 (DEPTH-03)', async () => {
    const u = await prisma.user.create({ data: { email: 'underdog@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: u.id, contextType: 'GLOBAL', balance: 1000n } });
    const m = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 7n, awayTeamId: 8n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    await prisma.matchOdds.create({ data: { matchId: m.id, mHome: 2.5, mDraw: 1.2, mAway: 0.8, source: 'API' } });

    const pred = await placeBet(prisma, { userId: u.id, matchId: m.id, pick: '1', stake: 100n });

    // HOME wins 2-1; base 1X2 = round(100*(1+2.5))=350, underdog bonus = round(350*0.15)=53 → 403
    await settleMatch(prisma, m.id, { home: 2, away: 1 });
    const settled = await prisma.prediction.findUniqueOrThrow({ where: { id: pred.id } });
    expect(settled.status).toBe('WON');
    expect(Number(settled.payout)).toBe(403);
  });

  it('placeBet stores an exact-score prediction; knockout settle awards the exact bonus (FR-SCORE-03)', async () => {
    const u = await prisma.user.create({ data: { email: 'ko@test.io', passwordHash: 'x' } });
    await prisma.wallet.create({ data: { userId: u.id, contextType: 'GLOBAL', balance: 1000n } });
    const ko = await prisma.match.create({
      data: { round: 'R16', homeTeamId: 5n, awayTeamId: 6n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    await prisma.matchOdds.create({ data: { matchId: ko.id, mHome: 1.0, mDraw: 1.2, mAway: 1.6, source: 'API' } });

    // bet HOME @ 1.0 with an exact-score call of 2-1
    const pred = await placeBet(prisma, { userId: u.id, matchId: ko.id, pick: '1', stake: 100n, exactHome: 2, exactAway: 1 });
    expect(pred.exactHome).toBe(2);
    expect(pred.exactAway).toBe(1);

    // settle exactly 2-1 (HOME win AND exact score) -> base 200 + knockout bonus 100 = 300
    await settleMatch(prisma, ko.id, { home: 2, away: 1 });
    const settled = await prisma.prediction.findUniqueOrThrow({ where: { id: pred.id } });
    expect(settled.status).toBe('WON');
    expect(Number(settled.payout)).toBe(300); // 200 (1X2) + 100 (exact bonus @ rate 1.0)
  });
});
