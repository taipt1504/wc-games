/**
 * @wc/prediction — Prediction & Settlement service (real Prisma + @wc/core).
 * Source of truth: PRD §04 + Prediction Service Design (escrow, idempotent settle, ledger).
 */
import type { PrismaClient, Prediction } from '@wc/db';
import { settleBet, type Pick1X2 } from '@wc/core';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

const WIN_STREAK_MILESTONES = [5, 10] as const;
const WIN_STREAK_BONUS = 500n;

/**
 * Recompute a user's win streak from their settled GLOBAL predictions (ordered by settledAt, id).
 * The streak = length of the trailing run of consecutive WON entries at the end of the ordered list.
 * Upserts the Streak row and awards a one-time BONUS if a milestone (5 or 10) is newly reached.
 */
async function recomputeWinStreak(tx: Tx, userId: bigint): Promise<number> {
  const settled = await tx.prediction.findMany({
    where: { userId, contextType: 'GLOBAL', status: { in: ['WON', 'LOST'] } },
    orderBy: [{ settledAt: 'asc' }, { id: 'asc' }],
    select: { status: true },
  });

  let streak = 0;
  for (let i = settled.length - 1; i >= 0; i--) {
    if (settled[i].status === 'WON') streak++;
    else break;
  }

  await tx.streak.upsert({
    where: { userId },
    create: { userId, winStreak: streak, checkinStreak: 0 },
    update: { winStreak: streak },
  });

  // Milestone bonus — paid at most once per milestone tier EVER (per user)
  for (const milestone of WIN_STREAK_MILESTONES) {
    if (streak !== milestone) continue;

    const existing = await tx.pointLedger.findFirst({
      where: { userId, type: 'BONUS', refType: 'WINSTREAK', refId: BigInt(milestone) },
    });
    if (existing) continue;

    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId, contextType: 'GLOBAL', contextId: null },
    });
    const newBal = wallet.balance + WIN_STREAK_BONUS;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
    await tx.pointLedger.create({
      data: {
        userId, contextType: 'GLOBAL', contextId: null,
        type: 'BONUS', amount: WIN_STREAK_BONUS, balanceAfter: newBal,
        refType: 'WINSTREAK', refId: BigInt(milestone),
      },
    });
  }

  return streak;
}

type Outcome = 'HOME' | 'DRAW' | 'AWAY';
const PICK_TO_OUTCOME: Record<Pick1X2, Outcome> = { '1': 'HOME', X: 'DRAW', '2': 'AWAY' };
const OUTCOME_TO_PICK: Record<Outcome, Pick1X2> = { HOME: '1', DRAW: 'X', AWAY: '2' };

export interface PlaceBetInput {
  userId: bigint;
  matchId: bigint;
  pick: Pick1X2;
  stake: bigint;
  // Optional exact-score prediction for knockout-stage bonus (PRD §04 / FR-SCORE-03).
  exactHome?: number;
  exactAway?: number;
}

/** Place a 1X2 bet in the GLOBAL context: escrow stake + create OPEN prediction + ledger (atomic). */
export async function placeBet(prisma: PrismaClient, input: PlaceBetInput): Promise<Prediction> {
  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({ where: { id: input.matchId }, include: { odds: true } });
    if (!match) throw new Error('MATCH_NOT_FOUND');
    if (match.status !== 'SCHEDULED' || match.kickoffAt.getTime() <= Date.now()) throw new Error('BET_LOCKED');
    if (!match.odds) throw new Error('ODDS_UNAVAILABLE');
    if (input.stake <= 0n) throw new Error('INVALID_STAKE');

    const outcome = PICK_TO_OUTCOME[input.pick];
    const odds = outcome === 'HOME' ? match.odds.mHome : outcome === 'DRAW' ? match.odds.mDraw : match.odds.mAway;

    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId: input.userId, contextType: 'GLOBAL', contextId: null },
    });
    if (wallet.balance < input.stake) throw new Error('INSUFFICIENT_BALANCE');

    const newBal = wallet.balance - input.stake;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    const prediction = await tx.prediction.create({
      data: {
        userId: input.userId, contextType: 'GLOBAL', contextId: null,
        matchId: input.matchId, market: '1X2', outcome, stake: input.stake,
        oddsSnapshot: odds, status: 'OPEN',
        exactHome: input.exactHome ?? null, exactAway: input.exactAway ?? null,
      },
    });
    await tx.pointLedger.create({
      data: {
        userId: input.userId, contextType: 'GLOBAL', contextId: null,
        type: 'STAKE', amount: -input.stake, balanceAfter: newBal,
        refType: 'PREDICTION', refId: prediction.id,
      },
    });
    return prediction;
  });
}

export interface SettleResult {
  alreadySettled: boolean;
  result?: Outcome;
  settledCount?: number;
}

/**
 * Settle all OPEN/LOCKED predictions for a finished match. Idempotent (guarded by Settlement row).
 * Credits payout via @wc/core, writes SETTLE ledger, updates prediction_user_stats for GLOBAL only.
 */
export async function settleMatch(prisma: PrismaClient, matchId: bigint, score: { home: number; away: number }): Promise<SettleResult> {
  const existing = await prisma.settlement.findUnique({ where: { matchId } });
  if (existing && existing.status === 'DONE') return { alreadySettled: true };

  const result: Outcome = score.home > score.away ? 'HOME' : score.home < score.away ? 'AWAY' : 'DRAW';
  const knockoutRounds = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];

  let settledCount = 0;
  await prisma.$transaction(async (tx) => {
    const match = await tx.match.findUniqueOrThrow({ where: { id: matchId } });
    await tx.match.update({
      where: { id: matchId },
      data: { status: 'FINISHED', scoreHome90: score.home, scoreAway90: score.away, result90: result },
    });

    const preds = await tx.prediction.findMany({ where: { matchId, status: { in: ['OPEN', 'LOCKED'] } } });
    const knockout = knockoutRounds.includes(match.round);
    const globalUserIds = new Set<bigint>();

    for (const p of preds) {
      const pick = OUTCOME_TO_PICK[p.outcome as Outcome];
      const r = settleBet({
        stake: Number(p.stake),
        odds: Number(p.oddsSnapshot),
        pick,
        homeGoals: score.home,
        awayGoals: score.away,
        knockout,
        exactPick: knockout && p.exactHome != null && p.exactAway != null ? { home: p.exactHome, away: p.exactAway } : undefined,
      });
      const payout = BigInt(Math.round(r.payout));

      const wallet = await tx.wallet.findFirstOrThrow({
        where: { userId: p.userId, contextType: p.contextType, contextId: p.contextId },
      });
      const newBal = wallet.balance + payout;
      if (payout > 0n) {
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
      }
      await tx.pointLedger.create({
        data: {
          userId: p.userId, contextType: p.contextType, contextId: p.contextId,
          type: 'SETTLE', amount: payout, balanceAfter: newBal,
          refType: 'PREDICTION', refId: p.id,
        },
      });
      await tx.prediction.update({
        where: { id: p.id },
        data: { status: r.won ? 'WON' : 'LOST', payout, settledAt: new Date() },
      });

      // ROI leaderboard aggregate — GLOBAL context only (lobby uses score_lobby)
      if (p.contextType === 'GLOBAL') {
        await tx.predictionUserStats.upsert({
          where: { userId: p.userId },
          create: { userId: p.userId, totalStaked: p.stake, totalReturned: payout, settledCount: 1, winCount: r.won ? 1 : 0 },
          update: {
            totalStaked: { increment: p.stake },
            totalReturned: { increment: payout },
            settledCount: { increment: 1 },
            winCount: { increment: r.won ? 1 : 0 },
          },
        });
        globalUserIds.add(p.userId);
      }
      settledCount++;
    }

    // Recompute win streak for each GLOBAL user whose predictions were settled in this match
    for (const uid of globalUserIds) {
      await recomputeWinStreak(tx, uid);
    }

    await tx.settlement.create({ data: { matchId, status: 'DONE', result90: result, settledAt: new Date(), settledBy: 'SYSTEM' } });
  });

  return { alreadySettled: false, result, settledCount };
}

/**
 * Admin re-settle (PRD §09 ADMIN-04): correct a wrong score after settlement.
 * Reverses the prior settlement (claws back credited payouts, undoes the ROI stats,
 * writes reversal ledger rows, returns predictions to LOCKED, drops the Settlement),
 * then re-runs settleMatch with the corrected score. Net-idempotent: re-running with
 * the same score produces the same wallet/stat state. Returns how many bets were reversed.
 */
export async function resettleMatch(
  prisma: PrismaClient,
  matchId: bigint,
  score: { home: number; away: number },
): Promise<SettleResult & { reversed: number }> {
  const existing = await prisma.settlement.findUnique({ where: { matchId } });
  let reversed = 0;

  if (existing && existing.status === 'DONE') {
    await prisma.$transaction(async (tx) => {
      const preds = await tx.prediction.findMany({ where: { matchId, status: { in: ['WON', 'LOST'] } } });
      for (const p of preds) {
        const payout = p.payout ?? 0n;
        if (payout > 0n) {
          const wallet = await tx.wallet.findFirstOrThrow({
            where: { userId: p.userId, contextType: p.contextType, contextId: p.contextId },
          });
          const newBal = wallet.balance - payout;
          await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
          await tx.pointLedger.create({
            data: {
              userId: p.userId, contextType: p.contextType, contextId: p.contextId,
              type: 'SETTLE', amount: -payout, balanceAfter: newBal,
              refType: 'PREDICTION', refId: p.id,
            },
          });
        }
        if (p.contextType === 'GLOBAL') {
          await tx.predictionUserStats.update({
            where: { userId: p.userId },
            data: {
              totalStaked: { decrement: p.stake },
              totalReturned: { decrement: payout },
              settledCount: { decrement: 1 },
              winCount: { decrement: p.status === 'WON' ? 1 : 0 },
            },
          });
        }
        await tx.prediction.update({ where: { id: p.id }, data: { status: 'LOCKED', payout: 0n, settledAt: null } });
        reversed++;
      }
      await tx.settlement.delete({ where: { matchId } });
    });
  }

  const res = await settleMatch(prisma, matchId, score);
  return { ...res, reversed };
}
