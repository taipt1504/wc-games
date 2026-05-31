import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { placeBet, settleMatch, resettleMatch } from './prediction-service';
import { buyPowerUp, grantPowerUp, listPowerUps } from './powerups';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.powerUp.deleteMany();
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

// ─────────── helpers ───────────

async function createUser(email: string, balance = 2000n) {
  const user = await prisma.user.create({ data: { email, passwordHash: 'x' } });
  await prisma.wallet.create({ data: { userId: user.id, contextType: 'GLOBAL', balance } });
  return user;
}

async function createMatch(homeTeam: bigint, awayTeam: bigint, mHome = 0.8, mAway = 1.5) {
  const m = await prisma.match.create({
    data: { round: 'GROUP', homeTeamId: homeTeam, awayTeamId: awayTeam, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
  });
  await prisma.matchOdds.create({ data: { matchId: m.id, mHome, mDraw: 1.1, mAway, source: 'API' } });
  return m;
}

// ─────────── buyPowerUp ───────────

describe('buyPowerUp', () => {
  it('debits GLOBAL wallet by price and increments qty', async () => {
    const u = await createUser('buy1@test.io', 500n);
    await buyPowerUp(prisma, u.id, 'INSURANCE');           // price 200

    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet.balance).toBe(300n);

    const inv = await listPowerUps(prisma, u.id);
    expect(inv['INSURANCE']).toBe(1);

    const ledger = await prisma.pointLedger.findMany({ where: { userId: u.id, type: 'PURCHASE' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(-200n);
    expect(ledger[0].refType).toBe('POWERUP');
  });

  it('buying a second time stacks qty', async () => {
    const u = await createUser('buy2@test.io', 1000n);
    await buyPowerUp(prisma, u.id, 'DOUBLE_DOWN');          // price 300
    await buyPowerUp(prisma, u.id, 'DOUBLE_DOWN');          // price 300
    const inv = await listPowerUps(prisma, u.id);
    expect(inv['DOUBLE_DOWN']).toBe(2);
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet.balance).toBe(400n);
  });

  it('throws INSUFFICIENT_BALANCE when wallet is too low', async () => {
    const u = await createUser('buy3@test.io', 100n);
    await expect(buyPowerUp(prisma, u.id, 'STREAK_SHIELD')).rejects.toThrow('INSUFFICIENT_BALANCE');
    // wallet unchanged, no inventory
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet.balance).toBe(100n);
    const inv = await listPowerUps(prisma, u.id);
    expect(inv['STREAK_SHIELD']).toBeUndefined();
  });
});

// ─────────── placeBet + powerUp ───────────

describe('placeBet with powerUp', () => {
  it('DOUBLE_DOWN: consumes 1 from inventory and sets prediction.powerUp', async () => {
    const u = await createUser('dd1@test.io', 2000n);
    await grantPowerUp(prisma, u.id, 'DOUBLE_DOWN');
    const m = await createMatch(500n, 501n);

    const pred = await placeBet(prisma, { userId: u.id, matchId: m.id, pick: '1', stake: 100n, powerUp: 'DOUBLE_DOWN' });
    expect(pred.powerUp).toBe('DOUBLE_DOWN');

    const inv = await listPowerUps(prisma, u.id);
    expect(inv['DOUBLE_DOWN']).toBe(0);
  });

  it('throws NO_POWERUP when user has none of that type', async () => {
    const u = await createUser('dd2@test.io', 2000n);
    const m = await createMatch(502n, 503n);

    await expect(placeBet(prisma, { userId: u.id, matchId: m.id, pick: '1', stake: 100n, powerUp: 'INSURANCE' }))
      .rejects.toThrow('NO_POWERUP');
  });

  it('throws NO_POWERUP when user has qty=0', async () => {
    const u = await createUser('dd3@test.io', 2000n);
    await grantPowerUp(prisma, u.id, 'INSURANCE', 1);
    // consume it first
    const m1 = await createMatch(504n, 505n);
    await placeBet(prisma, { userId: u.id, matchId: m1.id, pick: '1', stake: 50n, powerUp: 'INSURANCE' });

    // now try again on a different match — no inventory left
    const m2 = await createMatch(506n, 507n);
    await expect(placeBet(prisma, { userId: u.id, matchId: m2.id, pick: '1', stake: 50n, powerUp: 'INSURANCE' }))
      .rejects.toThrow('NO_POWERUP');
  });
});

// ─────────── settle: DOUBLE_DOWN ───────────

describe('settleMatch: DOUBLE_DOWN', () => {
  it('won: payout doubled vs identical bet without power-up', async () => {
    // User A: normal bet
    const uA = await createUser('ddWinA@test.io', 2000n);
    // User B: DOUBLE_DOWN
    const uB = await createUser('ddWinB@test.io', 2000n);
    await grantPowerUp(prisma, uB.id, 'DOUBLE_DOWN');

    // Both bet HOME @ 0.8, stake 100
    const m = await createMatch(600n, 601n, 0.8, 1.5);
    await placeBet(prisma, { userId: uA.id, matchId: m.id, pick: '1', stake: 100n });
    await placeBet(prisma, { userId: uB.id, matchId: m.id, pick: '1', stake: 100n, powerUp: 'DOUBLE_DOWN' });

    await settleMatch(prisma, m.id, { home: 2, away: 1 }); // HOME wins

    const predA = await prisma.prediction.findFirstOrThrow({ where: { matchId: m.id, userId: uA.id } });
    const predB = await prisma.prediction.findFirstOrThrow({ where: { matchId: m.id, userId: uB.id } });

    expect(predA.status).toBe('WON');
    expect(predB.status).toBe('WON');
    // base payout: round(100 * (1 + 0.8)) = 180; doubled = 360
    expect(predA.payout).toBe(180n);
    expect(predB.payout).toBe(360n);

    // Wallet B: 2000 - 100 (stake escrow) + 360 = 2260
    const walletB = await prisma.wallet.findFirstOrThrow({ where: { userId: uB.id } });
    expect(walletB.balance).toBe(2260n);

    // totalReturned for B should equal the actual payout credited
    const statsB = await prisma.predictionUserStats.findUniqueOrThrow({ where: { userId: uB.id } });
    expect(statsB.totalReturned).toBe(360n);
  });

  it('lost: DOUBLE_DOWN has no effect — payout = 0', async () => {
    const u = await createUser('ddLoss@test.io', 2000n);
    await grantPowerUp(prisma, u.id, 'DOUBLE_DOWN');
    const m = await createMatch(700n, 701n);
    await placeBet(prisma, { userId: u.id, matchId: m.id, pick: '2', stake: 100n, powerUp: 'DOUBLE_DOWN' }); // picks AWAY
    await settleMatch(prisma, m.id, { home: 2, away: 1 }); // HOME wins, AWAY pick loses

    const pred = await prisma.prediction.findFirstOrThrow({ where: { matchId: m.id, userId: u.id } });
    expect(pred.status).toBe('LOST');
    expect(pred.payout).toBe(0n);
  });
});

// ─────────── settle: INSURANCE ───────────

describe('settleMatch: INSURANCE', () => {
  it('lost: wallet receives stake back; prediction status stays LOST', async () => {
    const u = await createUser('insLoss@test.io', 2000n);
    await grantPowerUp(prisma, u.id, 'INSURANCE');
    const m = await createMatch(800n, 801n);
    await placeBet(prisma, { userId: u.id, matchId: m.id, pick: '2', stake: 150n, powerUp: 'INSURANCE' }); // picks AWAY
    await settleMatch(prisma, m.id, { home: 2, away: 1 }); // HOME wins → AWAY pick loses

    const pred = await prisma.prediction.findFirstOrThrow({ where: { matchId: m.id, userId: u.id } });
    expect(pred.status).toBe('LOST');
    expect(pred.payout).toBe(150n); // stake refunded

    // Wallet: 2000 - 150 + 150 = 2000 (no profit/loss)
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet.balance).toBe(2000n);

    // SETTLE ledger should record the refund amount
    const ledger = await prisma.pointLedger.findMany({ where: { userId: u.id, type: 'SETTLE' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(150n);

    // totalReturned consistent with actual payout
    const stats = await prisma.predictionUserStats.findUniqueOrThrow({ where: { userId: u.id } });
    expect(stats.totalReturned).toBe(150n);
    expect(stats.winCount).toBe(0); // not a win
  });

  it('won: INSURANCE has no additional effect; normal payout applies', async () => {
    const u = await createUser('insWin@test.io', 2000n);
    await grantPowerUp(prisma, u.id, 'INSURANCE');
    const m = await createMatch(900n, 901n);
    await placeBet(prisma, { userId: u.id, matchId: m.id, pick: '1', stake: 100n, powerUp: 'INSURANCE' }); // picks HOME
    await settleMatch(prisma, m.id, { home: 2, away: 1 }); // HOME wins

    const pred = await prisma.prediction.findFirstOrThrow({ where: { matchId: m.id, userId: u.id } });
    expect(pred.status).toBe('WON');
    // base 1X2 payout = round(100*(1+0.8)) = 180
    expect(pred.payout).toBe(180n);
  });
});

// ─────────── settle: DOUBLE_DOWN + resettle ───────────

describe('resettleMatch with DOUBLE_DOWN', () => {
  it('DOUBLE_DOWN won then resettle to loss → payout clawed back, wallet back to post-escrow balance', async () => {
    const u = await createUser('ddResettle@test.io', 2000n);
    await grantPowerUp(prisma, u.id, 'DOUBLE_DOWN');
    const m = await createMatch(1000n, 1001n);

    await placeBet(prisma, { userId: u.id, matchId: m.id, pick: '1', stake: 100n, powerUp: 'DOUBLE_DOWN' });
    // Settle HOME win → payout = 360
    await settleMatch(prisma, m.id, { home: 2, away: 1 });

    const wallet1 = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    expect(wallet1.balance).toBe(2260n); // 2000 - 100 + 360

    // Admin corrects to AWAY win → DOUBLE_DOWN HOME pick now loses
    await resettleMatch(prisma, m.id, { home: 1, away: 2 });

    const pred = await prisma.prediction.findFirstOrThrow({ where: { matchId: m.id, userId: u.id } });
    expect(pred.status).toBe('LOST');
    expect(pred.payout).toBe(0n);

    const wallet2 = await prisma.wallet.findFirstOrThrow({ where: { userId: u.id } });
    // Reversal claws back 360; re-settle pays 0 → 2000 - 100 = 1900
    expect(wallet2.balance).toBe(1900n);
  });
});

// ─────────── Streak Shield ───────────

describe('recomputeWinStreak: STREAK_SHIELD', () => {
  it('win, win, shielded-loss, win → streak 3 (shielded loss skipped)', async () => {
    const u = await createUser('shield1@test.io', 5000n);
    await grantPowerUp(prisma, u.id, 'STREAK_SHIELD', 1);

    // win 1
    const m1 = await createMatch(1100n, 1101n);
    await placeBet(prisma, { userId: u.id, matchId: m1.id, pick: '1', stake: 10n });
    await settleMatch(prisma, m1.id, { home: 2, away: 1 });

    // win 2
    const m2 = await createMatch(1102n, 1103n);
    await placeBet(prisma, { userId: u.id, matchId: m2.id, pick: '1', stake: 10n });
    await settleMatch(prisma, m2.id, { home: 2, away: 1 });

    // shielded loss
    const m3 = await createMatch(1104n, 1105n);
    await placeBet(prisma, { userId: u.id, matchId: m3.id, pick: '2', stake: 10n, powerUp: 'STREAK_SHIELD' }); // picks AWAY
    await settleMatch(prisma, m3.id, { home: 2, away: 1 }); // HOME wins → AWAY pick loses but shielded

    // win 3
    const m4 = await createMatch(1106n, 1107n);
    await placeBet(prisma, { userId: u.id, matchId: m4.id, pick: '1', stake: 10n });
    await settleMatch(prisma, m4.id, { home: 2, away: 1 });

    const streak = await prisma.streak.findUniqueOrThrow({ where: { userId: u.id } });
    expect(streak.winStreak).toBe(3);
  });

  it('win, win, unshielded-loss, win → streak 1 (normal loss still breaks)', async () => {
    const u = await createUser('shield2@test.io', 5000n);

    // win 1
    const m1 = await createMatch(1200n, 1201n);
    await placeBet(prisma, { userId: u.id, matchId: m1.id, pick: '1', stake: 10n });
    await settleMatch(prisma, m1.id, { home: 2, away: 1 });

    // win 2
    const m2 = await createMatch(1202n, 1203n);
    await placeBet(prisma, { userId: u.id, matchId: m2.id, pick: '1', stake: 10n });
    await settleMatch(prisma, m2.id, { home: 2, away: 1 });

    // unshielded loss
    const m3 = await createMatch(1204n, 1205n);
    await placeBet(prisma, { userId: u.id, matchId: m3.id, pick: '2', stake: 10n }); // picks AWAY, no shield
    await settleMatch(prisma, m3.id, { home: 2, away: 1 });

    // win 3
    const m4 = await createMatch(1206n, 1207n);
    await placeBet(prisma, { userId: u.id, matchId: m4.id, pick: '1', stake: 10n });
    await settleMatch(prisma, m4.id, { home: 2, away: 1 });

    const streak = await prisma.streak.findUniqueOrThrow({ where: { userId: u.id } });
    expect(streak.winStreak).toBe(1);
  });
});
