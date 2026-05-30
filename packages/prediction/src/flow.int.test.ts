import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { registerUser } from '@wc/auth';
import { placeBet, settleMatch, getGlobalLeaderboard } from './index';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.matchOdds.deleteMany();
  await prisma.match.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('full real flow (integration · Postgres): register -> bet -> settle -> leaderboard', () => {
  it('two users bet opposite sides; settle ranks the winner above the loser by ROI', async () => {
    // register (each gets 1000 + GLOBAL wallet + SIGNUP ledger)
    const alex = await registerUser(prisma, { email: 'alex@flow.io', username: 'alex', password: 'pw123456' });
    const sam = await registerUser(prisma, { email: 'sam@flow.io', username: 'sam', password: 'pw123456' });

    // a real fixture with odds in the DB
    const match = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 16n, awayTeamId: 18n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    await prisma.matchOdds.create({ data: { matchId: match.id, mHome: 0.8, mDraw: 1.1, mAway: 1.5, source: 'API' } });

    // Alex backs HOME, Sam backs AWAY — 100 each
    await placeBet(prisma, { userId: alex.id, matchId: match.id, pick: '1', stake: 100n });
    await placeBet(prisma, { userId: sam.id, matchId: match.id, pick: '2', stake: 100n });

    // HOME wins 2-1 -> Alex wins (payout 180, ROI +0.8), Sam loses (ROI -1.0)
    const settled = await settleMatch(prisma, match.id, { home: 2, away: 1 });
    expect(settled.settledCount).toBe(2);

    const alexWallet = await prisma.wallet.findFirstOrThrow({ where: { userId: alex.id } });
    expect(alexWallet.balance).toBe(1080n); // 1000 - 100 + 180
    const samWallet = await prisma.wallet.findFirstOrThrow({ where: { userId: sam.id } });
    expect(samWallet.balance).toBe(900n); // 1000 - 100 + 0

    const board = await getGlobalLeaderboard(prisma, { minSettled: 1, limit: 10 });
    expect(board).toHaveLength(2);
    expect(board[0].userId).toBe(alex.id);
    expect(board[0].roi).toBeCloseTo(0.8, 5);
    expect(board[0].winCount).toBe(1);
    expect(board[1].userId).toBe(sam.id);
    expect(board[1].roi).toBeCloseTo(-1.0, 5);
  });

  it('excludes users below the minSettled threshold', async () => {
    const board = await getGlobalLeaderboard(prisma, { minSettled: 5, limit: 10 });
    expect(board).toHaveLength(0); // each user has only 1 settled bet
  });
});
