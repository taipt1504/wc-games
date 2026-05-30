/** Global ROI-based leaderboard (PRD §04.9 / OQ-04). Ranks GLOBAL-context predictors. */
import type { PrismaClient } from '@wc/db';
import { roiPercent } from '@wc/core';

export interface LeaderboardEntry {
  rank: number;
  userId: bigint;
  roi: number;
  netProfit: number;
  settledCount: number;
  winCount: number;
}

/**
 * ROI leaderboard from prediction_user_stats (GLOBAL only — daily check-in points
 * never enter these aggregates, so they don't inflate rank). Requires >= minSettled
 * settled bets to qualify (anti small-sample). Ties broken by absolute net profit.
 */
export async function getGlobalLeaderboard(
  prisma: PrismaClient,
  opts: { minSettled?: number; limit?: number } = {},
): Promise<LeaderboardEntry[]> {
  const minSettled = opts.minSettled ?? 10;
  const limit = opts.limit ?? 50;

  const stats = await prisma.predictionUserStats.findMany({
    where: { settledCount: { gte: minSettled } },
  });

  return stats
    .map((s) => {
      const staked = Number(s.totalStaked);
      const returned = Number(s.totalReturned);
      return {
        userId: s.userId,
        roi: roiPercent(staked, returned),
        netProfit: returned - staked,
        settledCount: s.settledCount,
        winCount: s.winCount,
      };
    })
    .sort((a, b) => b.roi - a.roi || b.netProfit - a.netProfit)
    .slice(0, limit)
    .map((e, i) => ({ rank: i + 1, ...e }));
}
