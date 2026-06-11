/**
 * @wc/prediction — Special (novelty) market service. Isolated from Match. Mirrors placeBet/settleMatch
 * escrow+ledger and getLobbyOdds/setLobbyOdds host-auth. odds = profit multiplier (payout = stake×(1+odds)).
 */
import type { PrismaClient, SpecialMarket, SpecialLobbyOdds, SpecialPrediction } from '@wc/db';

/** win → stake + round(stake×odds); loss → 0. Pure (BigInt×Decimal must be done as Number here). */
export function specialPayout(stake: number, odds: number, won: boolean): number {
  return won ? stake + Math.round(stake * odds) : 0;
}

export interface SpecialOddsResult { oddsYes: number; oddsNo: number; source: 'LOBBY' | 'GLOBAL' }

/** Effective odds for a market in a context: lobby override → market global. Null if market missing. */
export async function resolveSpecialOdds(prisma: PrismaClient, marketId: bigint, lobbyId?: bigint): Promise<SpecialOddsResult | null> {
  if (lobbyId != null) {
    const lo = await prisma.specialLobbyOdds.findUnique({ where: { lobbyId_marketId: { lobbyId, marketId } } });
    if (lo) return { oddsYes: Number(lo.oddsYes), oddsNo: Number(lo.oddsNo), source: 'LOBBY' };
  }
  const m = await prisma.specialMarket.findUnique({ where: { id: marketId } });
  if (!m) return null;
  return { oddsYes: Number(m.oddsYes), oddsNo: Number(m.oddsNo), source: 'GLOBAL' };
}

export interface PlaceSpecialInput {
  userId: bigint; marketKey: string; pick: 'YES' | 'NO'; stake: bigint;
  contextType: 'GLOBAL' | 'LOBBY'; contextId: bigint | null;
}

/** Escrow a special-market bet (atomic). Market must be OPEN. Mirrors placeBet (wallet/STAKE ledger). */
export async function placeSpecialBet(prisma: PrismaClient, input: PlaceSpecialInput): Promise<SpecialPrediction> {
  return prisma.$transaction(async (tx) => {
    if (input.stake <= 0n) throw new Error('INVALID_STAKE');
    const market = await tx.specialMarket.findUnique({ where: { key: input.marketKey } });
    if (!market) throw new Error('MARKET_NOT_FOUND');
    if (market.status !== 'OPEN') throw new Error('MARKET_CLOSED');

    const odds = await resolveSpecialOdds(tx as unknown as PrismaClient, market.id, input.contextType === 'LOBBY' ? input.contextId ?? undefined : undefined);
    if (!odds) throw new Error('ODDS_UNAVAILABLE');
    const oddsSnapshot = input.pick === 'YES' ? odds.oddsYes : odds.oddsNo;

    // One open bet per (user, context, market). contextId NULL (GLOBAL) → unique index can't enforce; guard here.
    const dupe = await tx.specialPrediction.findFirst({
      where: { userId: input.userId, contextType: input.contextType, contextId: input.contextId, marketId: market.id, status: 'OPEN' },
    });
    if (dupe) throw new Error('ALREADY_BET');

    const wallet = await tx.wallet.findFirstOrThrow({ where: { userId: input.userId, contextType: input.contextType, contextId: input.contextId } });
    if (wallet.balance < input.stake) throw new Error('INSUFFICIENT_BALANCE');
    const newBal = wallet.balance - input.stake;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    const pred = await tx.specialPrediction.create({
      data: {
        userId: input.userId, contextType: input.contextType, contextId: input.contextId,
        marketId: market.id, pick: input.pick, stake: input.stake, oddsSnapshot, status: 'OPEN',
      },
    });
    await tx.pointLedger.create({
      data: {
        userId: input.userId, contextType: input.contextType, contextId: input.contextId,
        type: 'STAKE', amount: -input.stake, balanceAfter: newBal, refType: 'SPECIAL', refId: pred.id,
      },
    });
    return pred;
  });
}

/** Admin sets the market's global odds. */
export async function setSpecialOdds(prisma: PrismaClient, key: string, odds: { oddsYes: number; oddsNo: number }): Promise<SpecialMarket> {
  return prisma.specialMarket.update({ where: { key }, data: { oddsYes: odds.oddsYes, oddsNo: odds.oddsNo } });
}

/** Lobby host sets this lobby's odds override (host-auth; mirrors setLobbyOdds). */
export async function setSpecialLobbyOdds(prisma: PrismaClient, lobbyId: bigint, ownerId: bigint, marketKey: string, odds: { oddsYes: number; oddsNo: number }): Promise<SpecialLobbyOdds> {
  const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
  if (lobby.ownerId !== ownerId) throw new Error('NOT_OWNER');
  const market = await prisma.specialMarket.findUniqueOrThrow({ where: { key: marketKey } });
  return prisma.specialLobbyOdds.upsert({
    where: { lobbyId_marketId: { lobbyId, marketId: market.id } },
    create: { lobbyId, marketId: market.id, oddsYes: odds.oddsYes, oddsNo: odds.oddsNo },
    update: { oddsYes: odds.oddsYes, oddsNo: odds.oddsNo },
  });
}

/** Admin resolve YES/NO — locks the market + settles every OPEN bet from its own wallet. Idempotent. */
export async function resolveSpecialMarket(prisma: PrismaClient, key: string, outcome: 'YES' | 'NO'): Promise<{ alreadyResolved: boolean; settled: number }> {
  const market = await prisma.specialMarket.findUniqueOrThrow({ where: { key } });
  if (market.status === 'RESOLVED') return { alreadyResolved: true, settled: 0 };

  let settled = 0;
  await prisma.$transaction(async (tx) => {
    await tx.specialMarket.update({ where: { id: market.id }, data: { status: 'RESOLVED', resolvedOutcome: outcome, resolvedAt: new Date() } });
    const preds = await tx.specialPrediction.findMany({ where: { marketId: market.id, status: 'OPEN' } });
    for (const p of preds) {
      const won = p.pick === outcome;
      const payout = BigInt(specialPayout(Number(p.stake), Number(p.oddsSnapshot), won));
      const wallet = await tx.wallet.findFirstOrThrow({ where: { userId: p.userId, contextType: p.contextType, contextId: p.contextId } });
      const newBal = wallet.balance + payout;
      if (payout > 0n) await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
      await tx.pointLedger.create({
        data: { userId: p.userId, contextType: p.contextType, contextId: p.contextId, type: 'SETTLE', amount: payout, balanceAfter: newBal, refType: 'SPECIAL', refId: p.id },
      });
      await tx.specialPrediction.update({ where: { id: p.id }, data: { status: won ? 'WON' : 'LOST', payout, settledAt: new Date() } });
      settled++;
    }
  });
  return { alreadyResolved: false, settled };
}
