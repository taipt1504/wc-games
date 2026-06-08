/**
 * @wc/pipeline — football-data.org v4 source (spec docs/superpowers/specs/2026-06-09-football-data-integration-design.md).
 * One rate-limited client for all FD traffic; pure mappers translate FD JSON onto our Prisma enums
 * and are unit-tested against captured fixtures (no network, no key in CI).
 */
import type { MatchRound, MatchStatus, Outcome } from '@wc/db';

// ─────────────────────────── Raw API shapes (football-data.org v4) ───────────────────────────
export interface FdRef { id: number | null; name?: string | null; tla?: string | null }
export interface FdPlayer { id: number; name: string; position: string | null; dateOfBirth?: string; nationality?: string }
export interface FdTeam {
  id: number; name: string; shortName?: string; tla: string; crest?: string;
  coach?: { id?: number; name?: string | null } | null;
  squad?: FdPlayer[];
}
export interface FdScore {
  winner: 'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null;
  duration?: string;
  fullTime: { home: number | null; away: number | null };
  halfTime?: { home: number | null; away: number | null };
}
export interface FdMatch {
  id: number; utcDate: string; status: string;
  matchday: number | null; stage: string; group: string | null;
  homeTeam: FdRef; awayTeam: FdRef; score: FdScore;
}

// ─────────────────────────── Pure scalar mappers ───────────────────────────

/** FD status workflow → our MatchStatus enum. SCHEDULED|TIMED→SCHEDULED, IN_PLAY|PAUSED→LIVE,
 *  FINISHED|AWARDED→FINISHED, POSTPONED→POSTPONED, CANCELLED|SUSPENDED→CANCELLED. */
export function mapFdStatus(s: string): MatchStatus {
  switch (s) {
    case 'SCHEDULED': case 'TIMED': return 'SCHEDULED';
    case 'IN_PLAY': case 'PAUSED': return 'LIVE';
    case 'FINISHED': case 'AWARDED': return 'FINISHED';
    case 'POSTPONED': return 'POSTPONED';
    case 'CANCELLED': case 'SUSPENDED': return 'CANCELLED';
    default: return 'SCHEDULED';
  }
}

const STAGE: Record<string, MatchRound> = {
  GROUP_STAGE: 'GROUP', LAST_32: 'R32', LAST_16: 'R16',
  QUARTER_FINALS: 'QF', SEMI_FINALS: 'SF', THIRD_PLACE: 'THIRD', FINAL: 'FINAL',
};
/** FD `stage` → MatchRound. Throws on unknown so bad data never lands silently. */
export function mapFdStage(stage: string): MatchRound {
  const r = STAGE[stage];
  if (!r) throw new Error(`unknown FD stage: ${stage}`);
  return r;
}

/** "GROUP_A" → "A"; null → null. */
export function mapFdGroup(group: string | null): string | null {
  if (!group) return null;
  const m = group.match(/^GROUP_([A-L])$/);
  return m ? m[1] : null;
}

/** Coarse FD squad role → GK/DEF/MID/FWD (baseline; AI lineup worker refines near kickoff). */
export function mapFdPosition(pos: string | null): string | null {
  if (!pos) return null;
  const p = pos.toLowerCase();
  if (p.includes('keeper')) return 'GK';
  if (p.includes('defence') || p.includes('defender') || p.includes('back')) return 'DEF';
  if (p.includes('midfield')) return 'MID';
  if (p.includes('offence') || p.includes('forward') || p.includes('winger') || p.includes('striker') || p.includes('attack'))
    return 'FWD';
  return null;
}

export interface MappedScore { scoreHome90: number | null; scoreAway90: number | null; result90: Outcome | null }
/** FD score → our 90' fields. (Knockout fullTime may include ET/pens; `duration` distinguishes —
 *  we store fullTime as-is, accepting "90" is a label not a guarantee for knockouts.) */
export function mapFdScore(s: FdScore): MappedScore {
  const h = s.fullTime?.home ?? null;
  const a = s.fullTime?.away ?? null;
  if (h == null || a == null) return { scoreHome90: null, scoreAway90: null, result90: null };
  const result90: Outcome = s.winner === 'HOME_TEAM' ? 'HOME' : s.winner === 'AWAY_TEAM' ? 'AWAY' : 'DRAW';
  return { scoreHome90: h, scoreAway90: a, result90 };
}
