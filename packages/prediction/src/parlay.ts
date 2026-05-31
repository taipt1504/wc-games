/**
 * DEPTH-05: Combo/Parlay bets — multi-leg, pays only if ALL legs win.
 * PRD §06. Integrated with settleMatch via settleParlays (called after core settle tx).
 */
import type { PrismaClient, Parlay, ParlayLeg } from '@wc/db';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
type Outcome = 'HOME' | 'DRAW' | 'AWAY';

export interface ParlayLegInput {
  matchId: bigint;
  outcome: Outcome;
}

export interface PlaceParlayInput {
  userId: bigint;
  stake: bigint;
  legs: ParlayLegInput[];
}

export type ParlayWithLegs = Parlay & { legs: ParlayLeg[] };

/** Place a combo/parlay bet: escrow stake, create OPEN Parlay with PENDING legs. */
export async function placeParlay(prisma: PrismaClient, input: PlaceParlayInput): Promise<ParlayWithLegs> {
  if (input.legs.length < 2) throw new Error('TOO_FEW_LEGS');

  // Distinct match guard
  const matchIds = input.legs.map((l) => l.matchId);
  const uniqueMatchIds = new Set(matchIds.map(String));
  if (uniqueMatchIds.size !== matchIds.length) throw new Error('DUPLICATE_MATCH');

  return prisma.$transaction(async (tx) => {
    // Validate each match: SCHEDULED, future kickoff, has odds
    const legsWithOdds: Array<ParlayLegInput & { oddsSnapshot: number }> = [];

    for (const leg of input.legs) {
      const match = await tx.match.findUnique({ where: { id: leg.matchId }, include: { odds: true } });
      if (!match || match.status !== 'SCHEDULED' || match.kickoffAt.getTime() <= Date.now()) {
        throw new Error('BET_LOCKED');
      }
      if (!match.odds) throw new Error('ODDS_UNAVAILABLE');

      const oddsSnapshot =
        leg.outcome === 'HOME' ? Number(match.odds.mHome)
          : leg.outcome === 'DRAW' ? Number(match.odds.mDraw)
            : Number(match.odds.mAway);

      legsWithOdds.push({ ...leg, oddsSnapshot });
    }

    // Escrow stake from GLOBAL wallet
    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId: input.userId, contextType: 'GLOBAL', contextId: null },
    });
    if (wallet.balance < input.stake) throw new Error('INSUFFICIENT_BALANCE');

    const newBal = wallet.balance - input.stake;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    // Write STAKE ledger entry first so we have parlay id for refId
    const parlay = await tx.parlay.create({
      data: {
        userId: input.userId,
        stake: input.stake,
        status: 'OPEN',
        legs: {
          create: legsWithOdds.map((l) => ({
            matchId: l.matchId,
            outcome: l.outcome,
            oddsSnapshot: l.oddsSnapshot,
            result: 'PENDING',
          })),
        },
      },
      include: { legs: true },
    });

    await tx.pointLedger.create({
      data: {
        userId: input.userId,
        contextType: 'GLOBAL',
        contextId: null,
        type: 'STAKE',
        amount: -input.stake,
        balanceAfter: newBal,
        refType: 'PARLAY',
        refId: parlay.id,
      },
    });

    return parlay;
  });
}

/**
 * Settle all OPEN parlays that have a leg on matchId.
 * For each such parlay: resolve legs whose match is FINISHED, then:
 *   - ANY leg LOST → Parlay LOST (payout 0)
 *   - ALL legs resolved WON → Parlay WON, payout = round(stake × Π(1 + oddsSnapshot))
 *   - Otherwise (some still PENDING) → leave OPEN
 * IDEMPOTENT: only acts on OPEN parlays; re-running is a no-op.
 * Returns count of parlays moved to terminal status (WON or LOST) this run.
 */
export async function settleParlays(prisma: PrismaClient, matchId: bigint): Promise<number> {
  // Load all OPEN parlays that have at least one leg on this match
  const openParlays = await prisma.parlay.findMany({
    where: { status: 'OPEN', legs: { some: { matchId } } },
    include: { legs: true },
  });

  if (openParlays.length === 0) return 0;

  let resolved = 0;

  for (const parlay of openParlays) {
    await prisma.$transaction(async (tx) => {
      // Re-fetch legs fresh inside tx to avoid races
      const legs = await tx.parlayLeg.findMany({ where: { parlayId: parlay.id } });

      // Resolve each leg whose match is FINISHED
      const updatedLegs: Array<{ id: bigint; result: string; oddsSnapshot: number }> = [];

      for (const leg of legs) {
        if (leg.result !== 'PENDING') {
          // Already resolved; carry forward
          updatedLegs.push({ id: leg.id, result: leg.result!, oddsSnapshot: Number(leg.oddsSnapshot) });
          continue;
        }

        const match = await tx.match.findUnique({ where: { id: leg.matchId } });
        if (!match || match.status !== 'FINISHED' || !match.result90) {
          // Not finished yet — leg stays PENDING
          updatedLegs.push({ id: leg.id, result: 'PENDING', oddsSnapshot: Number(leg.oddsSnapshot) });
          continue;
        }

        const legResult = leg.outcome === match.result90 ? 'WON' : 'LOST';
        await tx.parlayLeg.update({ where: { id: leg.id }, data: { result: legResult } });
        updatedLegs.push({ id: leg.id, result: legResult, oddsSnapshot: Number(leg.oddsSnapshot) });
      }

      // Determine parlay outcome
      const hasLost = updatedLegs.some((l) => l.result === 'LOST');
      const allResolved = updatedLegs.every((l) => l.result !== 'PENDING');

      if (hasLost) {
        await tx.parlay.update({ where: { id: parlay.id }, data: { status: 'LOST', payout: 0n } });
        resolved++;
      } else if (allResolved) {
        // All WON — compute product payout
        const multiplier = updatedLegs.reduce((acc, l) => acc * (1 + l.oddsSnapshot), 1);
        const payout = BigInt(Math.round(Number(parlay.stake) * multiplier));

        // Credit GLOBAL wallet
        const wallet = await tx.wallet.findFirstOrThrow({
          where: { userId: parlay.userId, contextType: 'GLOBAL', contextId: null },
        });
        const newBal = wallet.balance + payout;
        await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
        await tx.pointLedger.create({
          data: {
            userId: parlay.userId,
            contextType: 'GLOBAL',
            contextId: null,
            type: 'SETTLE',
            amount: payout,
            balanceAfter: newBal,
            refType: 'PARLAY',
            refId: parlay.id,
          },
        });
        await tx.parlay.update({ where: { id: parlay.id }, data: { status: 'WON', payout } });
        resolved++;
      }
      // else: some PENDING — leave OPEN
    });
  }

  return resolved;
}
