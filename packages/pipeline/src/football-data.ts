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

// ─────────────────────────── Pure entity mappers ───────────────────────────

export interface MappedSquadPlayer { externalId: number; name: string; position: string | null }
export interface MappedFdTeam {
  externalId: number; name: string; code: string; flagUrl: string | null;
  manager: string | null; squad: MappedSquadPlayer[];
}
export function mapFdTeam(t: FdTeam): MappedFdTeam {
  return {
    externalId: t.id,
    name: t.name,
    code: t.tla,
    flagUrl: t.crest ?? null,
    manager: t.coach?.name ?? null,
    squad: (t.squad ?? []).map((p) => ({ externalId: p.id, name: p.name, position: mapFdPosition(p.position) })),
  };
}

export interface MappedFdMatch {
  externalId: number; round: MatchRound; groupLetter: string | null;
  homeTeamId: bigint; awayTeamId: bigint; kickoffAt: Date; status: MatchStatus;
  scoreHome90: number | null; scoreAway90: number | null; result90: Outcome | null;
}
/** Resolve FD team id → DB team id (via Team.externalId); null FD team (undrawn knockout) → 0n
 *  placeholder, matching the existing worldcup26 "0" convention (homeTeamId has no FK). */
export type ResolveTeamId = (fdTeamId: number | null) => bigint | null;
export function mapFdMatch(m: FdMatch, resolveTeamId: ResolveTeamId): MappedFdMatch {
  const round = mapFdStage(m.stage);
  const score = mapFdScore(m.score);
  return {
    externalId: m.id,
    round,
    groupLetter: round === 'GROUP' ? mapFdGroup(m.group) : null,
    homeTeamId: resolveTeamId(m.homeTeam.id) ?? 0n,
    awayTeamId: resolveTeamId(m.awayTeam.id) ?? 0n,
    kickoffAt: new Date(m.utcDate),
    status: mapFdStatus(m.status),
    scoreHome90: score.scoreHome90,
    scoreAway90: score.scoreAway90,
    result90: score.result90,
  };
}

// ─────────────────────────── Rate-limited client ───────────────────────────

export interface FdClientOpts {
  apiKey: string;
  baseUrl: string;
  minSpacingMs?: number;                 // default 7500 → ≤8 req/min (margin under the 10/min cap)
  maxRetries?: number;                   // default 2 (for 429)
  fetchFn?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

/** Single funnel for all football-data.org traffic. Serialized min-interval gate + 429 backoff.
 *  Time is injected so the limiter is unit-tested without real waiting. */
export class FdClient {
  private readonly key: string;
  private readonly base: string;
  private readonly spacing: number;
  private readonly maxRetries: number;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly sleep: (ms: number) => Promise<void>;
  private last = -Infinity;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(opts: FdClientOpts) {
    if (!opts.apiKey) throw new Error('FdClient: missing SPORTS_API_KEY');
    if (!opts.baseUrl) throw new Error('FdClient: missing SPORTS_API_BASE_URL');
    this.key = opts.apiKey;
    this.base = opts.baseUrl.replace(/\/$/, '');
    this.spacing = opts.minSpacingMs ?? 7500;
    this.maxRetries = opts.maxRetries ?? 2;
    this.fetchFn = opts.fetchFn ?? fetch;
    this.now = opts.now ?? Date.now;
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  /** GET `path` (relative to baseUrl), rate-limited + retried. Returns parsed JSON. */
  get<T = unknown>(path: string): Promise<T> {
    const run = this.chain.then(() => this.spacedRequest<T>(path));
    this.chain = run.then(() => undefined, () => undefined); // keep the queue moving on error
    return run;
  }

  private async spacedRequest<T>(path: string, attempt = 0): Promise<T> {
    const wait = this.spacing - (this.now() - this.last);
    if (wait > 0) await this.sleep(wait);
    this.last = this.now();

    const res = await this.fetchFn(`${this.base}${path}`, { headers: { 'X-Auth-Token': this.key } } as RequestInit);
    if (res.status === 429 && attempt < this.maxRetries) {
      const retryAfter = Number(this.header(res, 'retry-after')) || 60;
      await this.sleep(retryAfter * 1000);
      return this.spacedRequest<T>(path, attempt + 1);
    }
    if (!res.ok) throw new Error(`football-data ${path} → ${res.status}`);

    // If we're about to exhaust the per-minute budget, pause one window before the next call.
    const remaining = Number(this.header(res, 'x-requests-available-minute'));
    if (Number.isFinite(remaining) && remaining <= 1) this.last = this.now() + 60_000;

    return (await res.json()) as T;
  }

  private header(res: Response, name: string): string | null {
    const h = res.headers as unknown as { get?: (k: string) => string | null };
    return h.get ? h.get(name) : null;
  }
}

// ─────────────────────────── Typed fetchers + env factory ───────────────────────────

/** Minimal shape the sync functions need — lets tests stub the client without a real one. */
export interface FdClientLike { get<T = unknown>(path: string): Promise<T> }

const COMP = '/competitions/WC';

export async function fetchFdTeams(client: FdClientLike): Promise<FdTeam[]> {
  const r = await client.get<{ teams: FdTeam[] }>(`${COMP}/teams`);
  return r.teams;
}

export async function fetchFdMatches(
  client: FdClientLike,
  filters: { status?: string; dateFrom?: string; dateTo?: string; stage?: string } = {},
): Promise<FdMatch[]> {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v != null) as [string, string][],
  ).toString();
  const r = await client.get<{ matches: FdMatch[] }>(`${COMP}/matches${qs ? `?${qs}` : ''}`);
  return r.matches;
}

export async function fetchFdMatch(client: FdClientLike, id: number): Promise<FdMatch> {
  return client.get<FdMatch>(`/matches/${id}`);
}

/** Build a client from env (SPORTS_API_KEY + SPORTS_API_BASE_URL). Throws a clear error if unset. */
export function fdClientFromEnv(): FdClient {
  return new FdClient({
    apiKey: process.env.SPORTS_API_KEY ?? '',
    baseUrl: process.env.SPORTS_API_BASE_URL ?? '',
  });
}
