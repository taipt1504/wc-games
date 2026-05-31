/**
 * DEPTH-06: In-play micro-predictions placed during a LIVE match.
 * PRD §06.
 */
import type { PrismaClient, MicroPrediction } from '@wc/db';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Fixed odds multipliers per market/pick. payout = stake × (1 + multiplier) on win. */
export const MICRO_MARKETS: Record<string, Record<string, number>> = {
  NEXT_GOAL: {
    HOME: 1.8,
    AWAY: 2.2,
    NONE: 3.0,
  },
};

export interface PlaceMicroInput {
  userId: bigint;
  matchId: bigint;
  market: string;
  pick: string;
  stake: bigint;
}

/** Place a micro-prediction on a LIVE match. Escrows stake from GLOBAL wallet atomically. */
export async function placeMicro(
  prisma: PrismaClient,
  input: PlaceMicroInput,
): Promise<MicroPrediction> {
  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match || match.status !== 'LIVE') throw new Error('NOT_LIVE');

  const picks = MICRO_MARKETS[input.market];
  if (!picks || picks[input.pick] === undefined) throw new Error('INVALID_MARKET');

  const oddsMultiplier = picks[input.pick];

  return prisma.$transaction(async (tx: Tx) => {
    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId: input.userId, contextType: 'GLOBAL', contextId: null },
    });
    if (wallet.balance < input.stake) throw new Error('INSUFFICIENT_BALANCE');

    const newBal = wallet.balance - input.stake;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    const micro = await tx.microPrediction.create({
      data: {
        userId: input.userId,
        matchId: input.matchId,
        market: input.market,
        pick: input.pick,
        stake: input.stake,
        oddsSnapshot: oddsMultiplier,
        status: 'OPEN',
        payout: 0n,
      },
    });

    await tx.pointLedger.create({
      data: {
        userId: input.userId,
        contextType: 'GLOBAL',
        contextId: null,
        type: 'STAKE',
        amount: -input.stake,
        balanceAfter: newBal,
        refType: 'MICRO',
        refId: micro.id,
      },
    });

    return micro;
  });
}

export interface SettleMicroResult {
  status: string;
  payout: bigint;
}

/** Settle a micro-prediction. Idempotent guard: throws ALREADY_SETTLED if not OPEN. */
export async function settleMicro(
  prisma: PrismaClient,
  microId: bigint,
  won: boolean,
): Promise<SettleMicroResult> {
  return prisma.$transaction(async (tx: Tx) => {
    const micro = await tx.microPrediction.findUniqueOrThrow({ where: { id: microId } });
    if (micro.status !== 'OPEN') throw new Error('ALREADY_SETTLED');

    const oddsMultiplier = Number(micro.oddsSnapshot);
    const payout = won ? BigInt(Math.round(Number(micro.stake) * (1 + oddsMultiplier))) : 0n;
    const status = won ? 'WON' : 'LOST';

    if (won) {
      const wallet = await tx.wallet.findFirstOrThrow({
        where: { userId: micro.userId, contextType: 'GLOBAL', contextId: null },
      });
      const newBal = wallet.balance + payout;
      await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
      await tx.pointLedger.create({
        data: {
          userId: micro.userId,
          contextType: 'GLOBAL',
          contextId: null,
          type: 'SETTLE',
          amount: payout,
          balanceAfter: newBal,
          refType: 'MICRO',
          refId: micro.id,
        },
      });
    }

    await tx.microPrediction.update({
      where: { id: microId },
      data: { status, payout },
    });

    return { status, payout };
  });
}

/** List a user's micro-predictions, optionally filtered by matchId. */
export async function listMicro(
  prisma: PrismaClient,
  userId: bigint,
  matchId?: bigint,
): Promise<MicroPrediction[]> {
  return prisma.microPrediction.findMany({
    where: { userId, ...(matchId !== undefined ? { matchId } : {}) },
    orderBy: { createdAt: 'desc' },
  });
}
