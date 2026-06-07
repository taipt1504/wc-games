/**
 * @wc/pipeline — auto match-update scheduling (item 2).
 * Pure timing/decision helpers (unit-tested) + the lineup refresh used by the worker's
 * delayed BullMQ jobs:
 *   - lineup job at kickoff − 15min → AI-generate the projected XI for both teams.
 *   - result-check job at kickoff + 135min (90' + 45' buffer); re-checks every 30min until the
 *     real worldcup26 feed reports FINISHED (covers knockout ET/penalties), then auto-settles.
 * Results come from the live-score feed (real); AI is only used for the projected lineups.
 */
import type { PrismaClient } from '@wc/db';
import type { LlmGateway } from '@wc/ai';
import { crawlAndStoreSquads } from './squad';

export const LINEUP_LEAD_MS = 15 * 60_000; // T-15min
export const FIRST_RESULT_CHECK_MS = (90 + 45) * 60_000; // kickoff + regulation + buffer
export const RESULT_RECHECK_MS = 30 * 60_000; // ET/penalties cadence
export const MAX_RESULT_ATTEMPTS = 8; // first check + 8 re-checks ≈ 6h after kickoff, then give up to admin

/** ms until the lineup crawl should run (kickoff − 15min); 0 if already due/past. */
export function lineupDelayMs(kickoffAt: Date, now: number): number {
  return Math.max(0, kickoffAt.getTime() - LINEUP_LEAD_MS - now);
}

/** ms until the first result check (kickoff + 135min); 0 if already due/past. */
export function firstResultCheckDelayMs(kickoffAt: Date, now: number): number {
  return Math.max(0, kickoffAt.getTime() + FIRST_RESULT_CHECK_MS - now);
}

export type ResultAction = 'settle' | 'recheck' | 'stop';

/** Decide what a result-check job should do, given the match's current (feed-driven) state. */
export function decideResultCheck(
  match: { status: string; scoreHome90: number | null; scoreAway90: number | null },
  attempt: number,
): ResultAction {
  if (match.status === 'FINISHED' && match.scoreHome90 != null && match.scoreAway90 != null) return 'settle';
  if (attempt >= MAX_RESULT_ATTEMPTS) return 'stop';
  return 'recheck';
}

/** AI-refresh the projected starting XI for a match's two teams (reuses the squad crawl). */
export async function refreshMatchLineups(
  prisma: PrismaClient,
  gateway: LlmGateway,
  matchId: bigint,
): Promise<{ team: string; count: number; starters: number; status: string }[]> {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { homeTeamId: true, awayTeamId: true } });
  if (!match) return [];
  const teams = await prisma.team.findMany({
    where: { id: { in: [match.homeTeamId, match.awayTeamId] } },
    select: { id: true, name: true },
  });
  return crawlAndStoreSquads(prisma, gateway, teams);
}
