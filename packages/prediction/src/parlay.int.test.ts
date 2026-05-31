import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeParlay, settleParlays } from './parlay';
import { settleMatch } from './prediction-service';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.parlayLeg.deleteMany();
  await prisma.parlay.deleteMany();
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

// ─────────────── helpers ───────────────

async function createUser(email: string, balance = 2000n) {
  const user = await prisma.user.create({ data: { email, passwordHash: 'x' } });
  await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance } });
  return user;
}

let teamSeq = 500n;
async function createMatch(mHome = 0.8, mAway = 1.5) {
  const h = teamSeq++;
  const a = teamSeq++;
  const m = await prisma.match.create({
    data: { round: 'GROUP', homeTeamId: h, awayTeamId: a, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
  });
  await prisma.matchOdds.create({ data: { matchId: m.id, mHome, mDraw: 1.1, mAway, source: 'API' } });
  return m;
}

// ─────────────── placeParlay tests ───────────────

describe('placeParlay', () => {
  it('rejects a parlay with only 1 leg → TOO_FEW_LEGS', async () => {
    const u = await createUser('parlay-1leg@test.io');
    const m = await createMatch();
    await expect(
      placeParlay(prisma, { userId: u.id, stake: 100n, legs: [{ matchId: m.id, outcome: 'HOME' }] }),
    ).rejects.toThrow('TOO_FEW_LEGS');
  });

  it('places a 2-leg parlay: escrows stake, creates OPEN parlay with 2 PENDING legs', async () => {
    const u = await createUser('parlay-2leg@test.io', 1000n);
    const m1 = await createMatch(0.8, 1.5);
    const m2 = await createMatch(1.2, 0.9);

    const parlay = await placeParlay(prisma, {
      userId: u.id,
      stake: 100n,
      legs: [
        { matchId: m1.id, outcome: 'HOME' },
        { matchId: m2.id, outcome: 'AWAY' },
      ],
    });

    expect(parlay.status).toBe('OPEN');
    expect(parlay.stake).toBe(100n);
    expect(parlay.legs).toHaveLength(2);
    expect(parlay.legs.every((l) => l.result === 'PENDING')).toBe(true);

    // Wallet debited
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet.balance).toBe(900n); // 1000 - 100

    // STAKE ledger entry written
    const ledger = await prisma.pointLedger.findMany({ where: { userId: u.id, type: 'STAKE', refType: 'PARLAY' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(-100n);
    expect(ledger[0].balanceAfter).toBe(900n);
  });

  it('rejects duplicate matchIds in legs → DUPLICATE_MATCH', async () => {
    const u = await createUser('parlay-dup@test.io');
    const m = await createMatch();
    await expect(
      placeParlay(prisma, {
        userId: u.id,
        stake: 100n,
        legs: [
          { matchId: m.id, outcome: 'HOME' },
          { matchId: m.id, outcome: 'AWAY' },
        ],
      }),
    ).rejects.toThrow('DUPLICATE_MATCH');
  });

  it('rejects when balance insufficient → INSUFFICIENT_BALANCE', async () => {
    const u = await createUser('parlay-broke@test.io', 50n);
    const m1 = await createMatch();
    const m2 = await createMatch();
    await expect(
      placeParlay(prisma, {
        userId: u.id,
        stake: 100n,
        legs: [
          { matchId: m1.id, outcome: 'HOME' },
          { matchId: m2.id, outcome: 'HOME' },
        ],
      }),
    ).rejects.toThrow('INSUFFICIENT_BALANCE');
  });
});

// ─────────────── settleParlays tests ───────────────

describe('settleParlays — via settleMatch integration', () => {
  it('2-leg parlay: both legs win → Parlay WON, payout = round(stake × (1+o1)(1+o2)), wallet credited', async () => {
    const u = await createUser('parlay-win@test.io', 1000n);
    // m1: mHome=0.8; m2: mDraw=1.1
    const m1 = await createMatch(0.8, 1.5);
    const m2 = await createMatch(1.2, 0.9);

    const parlay = await placeParlay(prisma, {
      userId: u.id,
      stake: 100n,
      legs: [
        { matchId: m1.id, outcome: 'HOME' }, // oddsSnapshot 0.8
        { matchId: m2.id, outcome: 'DRAW' }, // oddsSnapshot 1.1
      ],
    });

    // Wallet at 900 after escrow
    const walletBefore = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(walletBefore.balance).toBe(900n);

    // Settle m1 HOME win 2-1 → leg1 WON, parlay still OPEN (leg2 pending)
    await settleMatch(prisma, m1.id, { home: 2, away: 1 });
    const parlayAfter1 = await prisma.parlay.findUniqueOrThrow({ where: { id: parlay.id } });
    expect(parlayAfter1.status).toBe('OPEN');

    // Settle m2 as DRAW 1-1 → leg2 WON → both WON → Parlay WON
    await settleMatch(prisma, m2.id, { home: 1, away: 1 });
    const parlayAfter2 = await prisma.parlay.findUniqueOrThrow({ where: { id: parlay.id } });
    expect(parlayAfter2.status).toBe('WON');

    // payout = round(100 × (1+0.8) × (1+1.1)) = round(100 × 1.8 × 2.1) = round(378) = 378
    const expectedPayout = BigInt(Math.round(100 * (1 + 0.8) * (1 + 1.1)));
    expect(parlayAfter2.payout).toBe(expectedPayout);

    // Wallet credited: 900 + payout
    const walletAfter = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(walletAfter.balance).toBe(900n + expectedPayout);

    // SETTLE ledger written with refType PARLAY
    const settleLedger = await prisma.pointLedger.findMany({
      where: { userId: u.id, type: 'SETTLE', refType: 'PARLAY' },
    });
    expect(settleLedger).toHaveLength(1);
    expect(settleLedger[0].amount).toBe(expectedPayout);
    expect(settleLedger[0].refId).toBe(parlay.id);
  });

  it('2-leg parlay: one leg loses → Parlay LOST, payout 0, no wallet credit', async () => {
    const u = await createUser('parlay-lose@test.io', 1000n);
    const m1 = await createMatch(0.8, 1.5);
    const m2 = await createMatch(1.2, 0.9);

    const parlay = await placeParlay(prisma, {
      userId: u.id,
      stake: 100n,
      legs: [
        { matchId: m1.id, outcome: 'HOME' }, // pick HOME
        { matchId: m2.id, outcome: 'HOME' }, // pick HOME
      ],
    });

    // m1: HOME wins → leg1 WON
    await settleMatch(prisma, m1.id, { home: 2, away: 1 });
    // m2: AWAY wins → leg2 LOST → Parlay LOST
    await settleMatch(prisma, m2.id, { home: 1, away: 2 });

    const parlayFinal = await prisma.parlay.findUniqueOrThrow({ where: { id: parlay.id } });
    expect(parlayFinal.status).toBe('LOST');
    expect(parlayFinal.payout).toBe(0n);

    // No SETTLE ledger for PARLAY (no credit)
    const settleLedger = await prisma.pointLedger.findMany({
      where: { userId: u.id, type: 'SETTLE', refType: 'PARLAY' },
    });
    expect(settleLedger).toHaveLength(0);

    // Wallet stays at escrow amount (900)
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet.balance).toBe(900n);
  });

  it('idempotency: re-running settleParlays on an already-settled parlay is a no-op', async () => {
    const u = await createUser('parlay-idempotent@test.io', 1000n);
    const m1 = await createMatch(0.8, 1.5);
    const m2 = await createMatch(1.2, 0.9);

    const parlay = await placeParlay(prisma, {
      userId: u.id,
      stake: 100n,
      legs: [
        { matchId: m1.id, outcome: 'HOME' },
        { matchId: m2.id, outcome: 'HOME' },
      ],
    });

    // Settle both — m2 AWAY wins, so parlay LOST
    await settleMatch(prisma, m1.id, { home: 2, away: 1 });
    await settleMatch(prisma, m2.id, { home: 1, away: 2 });

    const parlayAfter = await prisma.parlay.findUniqueOrThrow({ where: { id: parlay.id } });
    expect(parlayAfter.status).toBe('LOST');

    const walletBefore = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });

    // Run settleParlays again on each match — should be no-op (0 parlays acted on)
    const r1 = await settleParlays(prisma, m1.id);
    const r2 = await settleParlays(prisma, m2.id);
    expect(r1).toBe(0);
    expect(r2).toBe(0);

    // Wallet unchanged, parlay still LOST
    const walletAfter = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(walletAfter.balance).toBe(walletBefore.balance);
    const parlayFinal = await prisma.parlay.findUniqueOrThrow({ where: { id: parlay.id } });
    expect(parlayFinal.status).toBe('LOST');
  });
});
