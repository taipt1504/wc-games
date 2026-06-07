/**
 * Live-score sync (PRD §15 cadence: LIVE poll). Polls worldcup26.ir /get/games and writes the
 * current score + status onto Match. Does NOT settle — per PRD §15, settlement of points stays
 * admin-confirmed (Phase 4); this only keeps scores/status fresh for display + the live feed.
 */
import type { PrismaClient, MatchStatus, Outcome } from '@wc/db';
import { publishEvent, channels } from '@wc/realtime';
import { mapStatus, type WcGame, type FetchJson } from './ingest';

export interface LiveUpdate {
  status: MatchStatus;
  scoreHome90: number | null;
  scoreAway90: number | null;
  result90: Outcome | null;
}

/** Pure: derive the score/status update for one game. Running score lives in scoreHome90/away90. */
export function liveScoreUpdate(g: WcGame): LiveUpdate {
  const status = mapStatus(g);
  if (status === 'SCHEDULED') return { status, scoreHome90: null, scoreAway90: null, result90: null };
  const sh = Number(g.home_score);
  const sa = Number(g.away_score);
  const result90 = status === 'FINISHED' ? (sh > sa ? 'HOME' : sh < sa ? 'AWAY' : 'DRAW') : null;
  return { status, scoreHome90: sh, scoreAway90: sa, result90 };
}

const BASE = process.env.WC_API_BASE ?? 'https://worldcup26.ir';
const defaultFetch: FetchJson = async (path) => {
  const res = await fetch(`${BASE}/get/${path}`);
  if (!res.ok) throw new Error(`worldcup26 /${path} → ${res.status}`);
  return res.json();
};

/**
 * Poll games and update only the matches whose score/status changed. Returns the count updated
 * and the ids that newly transitioned to FINISHED (for the admin settle queue — Phase 4).
 */
export async function updateLiveScores(
  prisma: PrismaClient,
  fetchJson: FetchJson = defaultFetch,
): Promise<{ updated: number; newlyFinished: number[] }> {
  const games = ((await fetchJson('games')) as { games: WcGame[] }).games;
  let updated = 0;
  const newlyFinished: number[] = [];
  for (const g of games) {
    const id = BigInt(g.id);
    const existing = await prisma.match.findUnique({ where: { id }, select: { status: true, scoreHome90: true, scoreAway90: true, source: true } });
    if (!existing) continue;
    // Admin-confirmed result is authoritative — never let the live poll overwrite it (would revert
    // a FINISHED match back to SCHEDULED when worldcup26 still lists the fixture as upcoming).
    if (existing.source === 'ADMIN') continue;
    const u = liveScoreUpdate(g);
    if (existing.status === u.status && existing.scoreHome90 === u.scoreHome90 && existing.scoreAway90 === u.scoreAway90) continue;
    await prisma.match.update({
      where: { id },
      data: { status: u.status, scoreHome90: u.scoreHome90, scoreAway90: u.scoreAway90, result90: u.result90, source: 'API' },
    });
    updated++;
    // Realtime: signal clients to re-fetch this match (best-effort).
    await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) });
    if (u.status === 'FINISHED' && existing.status !== 'FINISHED') newlyFinished.push(Number(id));
  }
  return { updated, newlyFinished };
}

/** Sync ONE match's score/status from the feed on demand (admin "sync result"). Throws if the
 *  match id isn't in the feed. Does NOT settle — settlement stays the admin confirm/resettle path. */
export async function syncOneMatchResult(
  prisma: PrismaClient,
  matchId: bigint,
  fetchJson: FetchJson = defaultFetch,
): Promise<{ updated: boolean; status: MatchStatus; scoreHome90: number | null; scoreAway90: number | null }> {
  const games = ((await fetchJson('games')) as { games: WcGame[] }).games;
  const g = games.find((x) => BigInt(x.id) === matchId);
  if (!g) throw new Error('MATCH_NOT_IN_FEED');
  const u = liveScoreUpdate(g);
  await prisma.match.update({
    where: { id: matchId },
    data: { status: u.status, scoreHome90: u.scoreHome90, scoreAway90: u.scoreAway90, result90: u.result90, source: 'API' },
  });
  await publishEvent(channels.matches, { type: 'match.update', matchId: Number(matchId) });
  return { updated: true, status: u.status, scoreHome90: u.scoreHome90, scoreAway90: u.scoreAway90 };
}
