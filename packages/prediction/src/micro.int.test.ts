import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeMicro, settleMicro } from './micro';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.microPrediction.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.match.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

let teamSeq = 900n;
async function createLiveMatch() {
  const h = teamSeq++;
  const a = teamSeq++;
  return prisma.match.create({
    data: { round: 'GROUP', homeTeamId: h, awayTeamId: a, kickoffAt: new Date(Date.now() - 30 * 60_000), status: 'LIVE' },
  });
}

async function createUser(email: string, balance = 1000n) {
  const user = await prisma.user.create({ data: { email, passwordHash: 'x' } });
  await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance } });
  return user;
}

describe('micro (integration · Postgres)', () => {
  it('placeMicro on a LIVE match escrows stake + creates OPEN micro + STAKE ledger', async () => {
    const user = await createUser('micro-place@test.io');
    const match = await createLiveMatch();

    const micro = await placeMicro(prisma, {
      userId: user.id,
      matchId: match.id,
      market: 'NEXT_GOAL',
      pick: 'HOME',
      stake: 100n,
    });

    expect(micro.status).toBe('OPEN');
    expect(micro.market).toBe('NEXT_GOAL');
    expect(micro.pick).toBe('HOME');
    expect(micro.stake).toBe(100n);
    expect(Number(micro.oddsSnapshot)).toBe(1.8);

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: user.id } });
    expect(wallet.balance).toBe(900n); // 1000 - 100 escrow

    const ledger = await prisma.pointLedger.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].type).toBe('STAKE');
    expect(ledger[0].amount).toBe(-100n);
    expect(ledger[0].refType).toBe('MICRO');
    expect(ledger[0].balanceAfter).toBe(900n);
  });

  it('placeMicro on a SCHEDULED match → throws NOT_LIVE', async () => {
    const user = await createUser('micro-notlive@test.io');
    const match = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 950n, awayTeamId: 951n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });

    await expect(
      placeMicro(prisma, { userId: user.id, matchId: match.id, market: 'NEXT_GOAL', pick: 'HOME', stake: 50n })
    ).rejects.toThrow('NOT_LIVE');
  });

  it('placeMicro with invalid market → throws INVALID_MARKET', async () => {
    const user = await createUser('micro-invalid@test.io');
    const match = await createLiveMatch();

    await expect(
      placeMicro(prisma, { userId: user.id, matchId: match.id, market: 'INVALID_MKT', pick: 'HOME', stake: 50n })
    ).rejects.toThrow('INVALID_MARKET');
  });

  it('placeMicro with invalid pick → throws INVALID_MARKET', async () => {
    const user = await createUser('micro-badpick@test.io');
    const match = await createLiveMatch();

    await expect(
      placeMicro(prisma, { userId: user.id, matchId: match.id, market: 'NEXT_GOAL', pick: 'DRAW', stake: 50n })
    ).rejects.toThrow('INVALID_MARKET');
  });

  it('placeMicro with insufficient balance → throws INSUFFICIENT_BALANCE', async () => {
    const user = await createUser('micro-broke@test.io', 10n);
    const match = await createLiveMatch();

    await expect(
      placeMicro(prisma, { userId: user.id, matchId: match.id, market: 'NEXT_GOAL', pick: 'AWAY', stake: 100n })
    ).rejects.toThrow('INSUFFICIENT_BALANCE');
  });

  it('settleMicro won → credits wallet stake×(1+odds), status WON', async () => {
    const user = await createUser('micro-won@test.io');
    const match = await createLiveMatch();

    const micro = await placeMicro(prisma, {
      userId: user.id, matchId: match.id, market: 'NEXT_GOAL', pick: 'AWAY', stake: 100n,
    });
    // odds = 2.2 → payout = round(100 * (1 + 2.2)) = round(320) = 320
    const walletBefore = await prisma.wallet.findFirstOrThrow({ where: { userId: user.id } });
    expect(walletBefore.balance).toBe(900n);

    const result = await settleMicro(prisma, micro.id, true);
    expect(result.status).toBe('WON');
    expect(result.payout).toBe(320n);

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: user.id } });
    expect(wallet.balance).toBe(1220n); // 900 + 320

    const settled = await prisma.microPrediction.findUniqueOrThrow({ where: { id: micro.id } });
    expect(settled.status).toBe('WON');
    expect(settled.payout).toBe(320n);

    const settleLedger = await prisma.pointLedger.findMany({ where: { userId: user.id, type: 'SETTLE' } });
    expect(settleLedger).toHaveLength(1);
    expect(settleLedger[0].amount).toBe(320n);
    expect(settleLedger[0].refType).toBe('MICRO');
  });

  it('settleMicro lost → no credit, status LOST, payout 0', async () => {
    const user = await createUser('micro-lost@test.io');
    const match = await createLiveMatch();

    const micro = await placeMicro(prisma, {
      userId: user.id, matchId: match.id, market: 'NEXT_GOAL', pick: 'NONE', stake: 200n,
    });

    const result = await settleMicro(prisma, micro.id, false);
    expect(result.status).toBe('LOST');
    expect(result.payout).toBe(0n);

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: user.id } });
    expect(wallet.balance).toBe(800n); // 1000 - 200 (no credit on loss)

    const settled = await prisma.microPrediction.findUniqueOrThrow({ where: { id: micro.id } });
    expect(settled.status).toBe('LOST');
    expect(settled.payout).toBe(0n);

    const settleLedger = await prisma.pointLedger.findMany({ where: { userId: user.id, type: 'SETTLE' } });
    expect(settleLedger).toHaveLength(0); // no SETTLE ledger on loss
  });

  it('settleMicro re-settle → throws ALREADY_SETTLED', async () => {
    const user = await createUser('micro-resettled@test.io');
    const match = await createLiveMatch();

    const micro = await placeMicro(prisma, {
      userId: user.id, matchId: match.id, market: 'NEXT_GOAL', pick: 'HOME', stake: 50n,
    });

    await settleMicro(prisma, micro.id, true);
    await expect(settleMicro(prisma, micro.id, true)).rejects.toThrow('ALREADY_SETTLED');
    await expect(settleMicro(prisma, micro.id, false)).rejects.toThrow('ALREADY_SETTLED');
  });
});
