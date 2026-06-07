/**
 * @wc/pipeline — real WC2026 tournament ingest (PRD §15 free-provider path).
 * Source: worldcup26.ir (keyless GET). Replaces the synthetic @wc/fixtures seed with
 * real teams/groups/venues/fixtures. Players, odds (real), news and live scores are NOT
 * provided by this API — players come from AI-crawl (2B); odds are a house line here.
 *
 * Mappers are pure + exported so the field mapping is unit-tested against captured JSON
 * fixtures (no live API call in CI).
 */
import type { PrismaClient, MatchRound, MatchStatus, Outcome } from '@wc/db';
import { publishEvent, channels } from '@wc/realtime';

// ─────────────────────────── Raw API shapes (worldcup26.ir) ───────────────────────────
export interface WcTeam { id: string; name_en: string; fifa_code: string; flag: string; iso2: string; groups: string }
export interface WcStadium { id: string; name_en: string; city_en: string; country_en: string; capacity: number }
export interface WcGame {
  id: string; home_team_id: string; away_team_id: string;
  home_score: string; away_score: string; group: string; matchday: string;
  local_date: string; stadium_id: string; finished: string; time_elapsed: string; type: string;
}

// ─────────────────────────── Pure mappers ───────────────────────────

const ROUND: Record<string, MatchRound> = {
  group: 'GROUP', r32: 'R32', r16: 'R16', qf: 'QF', sf: 'SF', third: 'THIRD', final: 'FINAL',
};

/** worldcup26 `type` → MatchRound enum. Throws on unknown so bad data never lands silently. */
export function mapRound(type: string): MatchRound {
  const r = ROUND[type.toLowerCase()];
  if (!r) throw new Error(`unknown match type: ${type}`);
  return r;
}

/** "MM/DD/YYYY HH:MM" → Date. Treated as UTC (API gives no per-venue tz); deterministic. */
export function parseKickoff(local: string): Date {
  const m = local.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (!m) throw new Error(`bad local_date: ${local}`);
  const [, mm, dd, yyyy, hh, min] = m;
  return new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +min));
}

export function mapStatus(g: { finished: string; time_elapsed: string }): MatchStatus {
  if (g.finished === 'TRUE') return 'FINISHED';
  if (g.time_elapsed && g.time_elapsed !== 'notstarted') return 'LIVE';
  return 'SCHEDULED';
}

function outcome(home: number, away: number): Outcome {
  return home > away ? 'HOME' : home < away ? 'AWAY' : 'DRAW';
}

export interface MappedMatch {
  id: bigint; round: MatchRound; groupLetter: string | null;
  homeTeamId: bigint; awayTeamId: bigint; venueId: bigint | null;
  kickoffAt: Date; status: MatchStatus;
  scoreHome90: number | null; scoreAway90: number | null; result90: Outcome | null;
}

export function mapGame(g: WcGame): MappedMatch {
  const round = mapRound(g.type);
  const status = mapStatus(g);
  const scored = status === 'FINISHED' || status === 'LIVE';
  const sh = scored ? Number(g.home_score) : null;
  const sa = scored ? Number(g.away_score) : null;
  return {
    id: BigInt(g.id),
    round,
    groupLetter: round === 'GROUP' ? g.group : null, // knockout `group` is R32/QF/… not a real group
    homeTeamId: BigInt(g.home_team_id), // "0" for not-yet-drawn knockout teams (no FK → safe)
    awayTeamId: BigInt(g.away_team_id),
    venueId: g.stadium_id ? BigInt(g.stadium_id) : null,
    kickoffAt: parseKickoff(g.local_date),
    status,
    scoreHome90: status === 'FINISHED' ? sh : null,
    scoreAway90: status === 'FINISHED' ? sa : null,
    result90: status === 'FINISHED' && sh != null && sa != null ? outcome(sh, sa) : null,
  };
}

/** Deterministic house odds — rank-free (API gives no FIFA rank). Stable per match id. */
function rng(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
export function houseOdds(id: bigint): { mHome: number; mDraw: number; mAway: number } {
  const n = Number(id);
  const r = (x: number) => Math.round(x * 100) / 100;
  return { mHome: r(1.55 + rng(n) * 0.5), mDraw: r(1.9 + rng(n + 1) * 0.5), mAway: r(1.7 + rng(n + 2) * 0.6) };
}

// ─────────────────────────── Ingest (impure) ───────────────────────────

export type FetchJson = (path: 'teams' | 'stadiums' | 'games') => Promise<unknown>;

const BASE = process.env.WC_API_BASE ?? 'https://worldcup26.ir';
const defaultFetch: FetchJson = async (path) => {
  const res = await fetch(`${BASE}/get/${path}`);
  if (!res.ok) throw new Error(`worldcup26 /${path} → ${res.status}`);
  return res.json();
};

/**
 * Replace synthetic tournament data with real worldcup26.ir data. Idempotent (wipe-then-load).
 * Wipe is tournament-tables-only — predictions/settlements/ledger are untouched (PRD §14
 * append-only ledger preserved). Groups are upserted (kept) so team.groupId stays valid.
 */
export async function ingestTournament(
  prisma: PrismaClient,
  fetchJson: FetchJson = defaultFetch,
): Promise<{ teams: number; venues: number; matches: number }> {
  const [teamsRaw, stadiumsRaw, gamesRaw] = await Promise.all([
    fetchJson('teams'), fetchJson('stadiums'), fetchJson('games'),
  ]);
  const teams = (teamsRaw as { teams: WcTeam[] }).teams;
  const stadiums = (stadiumsRaw as { stadiums: WcStadium[] }).stadiums;
  const games = (gamesRaw as { games: WcGame[] }).games;

  // Wipe tournament tables only (FK-safe order). No ledger/prediction rows involved.
  // aiPreview is a match-derived cache → invalidate it so stale previews don't outlive a re-ingest.
  await prisma.$transaction([
    prisma.aiPreview.deleteMany(),
    prisma.matchOdds.deleteMany(),
    prisma.match.deleteMany(),
    prisma.player.deleteMany(),
    prisma.team.deleteMany(),
    prisma.venue.deleteMany(),
  ]);

  // Groups A–L (upsert, kept across runs).
  const groupId: Record<string, bigint> = {};
  for (const name of 'ABCDEFGHIJKL') {
    const g = await prisma.group.upsert({ where: { name }, create: { name }, update: {} });
    groupId[name] = g.id;
  }

  for (const s of stadiums) {
    await prisma.venue.create({ data: { id: BigInt(s.id), name: s.name_en, city: s.city_en, country: s.country_en } });
  }
  for (const t of teams) {
    await prisma.team.create({
      data: { id: BigInt(t.id), name: t.name_en, code: t.fifa_code, flagUrl: t.flag, groupId: groupId[t.groups] ?? null },
    });
  }
  for (const g of games) {
    const m = mapGame(g);
    await prisma.match.create({
      data: {
        id: m.id, round: m.round, groupId: m.groupLetter ? groupId[m.groupLetter] : null,
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, venueId: m.venueId,
        kickoffAt: m.kickoffAt, status: m.status,
        scoreHome90: m.scoreHome90 ?? undefined, scoreAway90: m.scoreAway90 ?? undefined,
        result90: m.result90 ?? undefined, source: 'API',
      },
    });
    const o = houseOdds(m.id);
    await prisma.matchOdds.create({ data: { matchId: m.id, mHome: o.mHome, mDraw: o.mDraw, mAway: o.mAway, source: 'ADMIN' } });
  }

  return { teams: teams.length, venues: stadiums.length, matches: games.length };
}

/**
 * Match-only sync from the worldcup26 feed — upserts fixtures + house odds WITHOUT touching
 * teams/players/venues (unlike ingestTournament's wipe-then-load). Safe to run repeatedly and
 * the right tool to re-populate matches without nuking AI-crawled players. Guards:
 *   - existing match with source=ADMIN → skipped (never revert an admin-confirmed result)
 *   - odds created only if missing (never clobber an admin-set line)
 * Publishes match.update per touched match so connected clients refresh live (R3).
 */
export async function syncMatchesFromFeed(
  prisma: PrismaClient,
  fetchJson: FetchJson = defaultFetch,
): Promise<{ created: number; updated: number; skipped: number }> {
  const games = ((await fetchJson('games')) as { games: WcGame[] }).games;

  const groups = await prisma.group.findMany({ select: { id: true, name: true } });
  const groupId: Record<string, bigint> = {};
  for (const g of groups) groupId[g.name] = g.id;

  let created = 0, updated = 0, skipped = 0;
  for (const game of games) {
    const m = mapGame(game);
    const existing = await prisma.match.findUnique({ where: { id: m.id }, select: { source: true } });
    if (existing?.source === 'ADMIN') { skipped++; continue; }

    const data = {
      round: m.round,
      groupId: m.groupLetter ? (groupId[m.groupLetter] ?? null) : null,
      homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, venueId: m.venueId,
      kickoffAt: m.kickoffAt, status: m.status,
      scoreHome90: m.scoreHome90, scoreAway90: m.scoreAway90, result90: m.result90,
      source: 'API' as const,
    };
    await prisma.match.upsert({ where: { id: m.id }, create: { id: m.id, ...data }, update: data });
    if (existing) updated++; else created++;

    const odds = await prisma.matchOdds.findUnique({ where: { matchId: m.id } });
    if (!odds) {
      const o = houseOdds(m.id);
      await prisma.matchOdds.create({ data: { matchId: m.id, mHome: o.mHome, mDraw: o.mDraw, mAway: o.mAway, source: 'ADMIN' } });
    }
    await publishEvent(channels.matches, { type: 'match.update', matchId: Number(m.id) });
  }
  return { created, updated, skipped };
}
