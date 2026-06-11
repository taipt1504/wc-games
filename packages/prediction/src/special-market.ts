/**
 * @wc/prediction — Special (novelty) market service. Isolated from Match. Mirrors placeBet/settleMatch
 * escrow+ledger and getLobbyOdds/setLobbyOdds host-auth. odds = profit multiplier (payout = stake×(1+odds)).
 */
import type { PrismaClient } from '@wc/db';

/** win → stake + round(stake×odds); loss → 0. Pure (BigInt×Decimal must be done as Number here). */
export function specialPayout(stake: number, odds: number, won: boolean): number {
  return won ? stake + Math.round(stake * odds) : 0;
}
