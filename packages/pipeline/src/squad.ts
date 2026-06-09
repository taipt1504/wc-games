/**
 * @wc/pipeline — squad/lineup AI-crawl (PRD §15 AI-crawl fallback for data the free API lacks).
 * worldcup26.ir has no squads, so the lineup (formation + starting XI + specific positions +
 * manager + bench) is sourced via the LLM gateway, grounded to real internationals + validated.
 * AI-assisted → labelled in the UI.
 */
import type { PrismaClient } from '@wc/db';
import type { LlmGateway } from '@wc/ai';

export interface CrawledPlayer { number: number | null; name: string; position: string; starter: boolean }
export interface CrawledLineup { manager: string; formation: string; players: CrawledPlayer[] }

/** Parse + validate an LLM lineup response (object). Tolerates fences/wrappers; drops bad rows. */
export function parseLineupJson(raw: string): CrawledLineup {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0 || end < start) throw new Error('no JSON object in response');
  const obj = JSON.parse(raw.slice(start, end + 1));
  const manager = typeof obj?.manager === 'string' ? obj.manager.trim() : '';
  const formation = typeof obj?.formation === 'string' ? obj.formation.trim() : '';
  const arr = Array.isArray(obj?.players) ? obj.players : [];

  const seen = new Set<string>();
  const players: CrawledPlayer[] = [];
  for (const p of arr) {
    const name = typeof p?.name === 'string' ? p.name.trim() : '';
    const position = typeof p?.position === 'string' ? p.position.trim().toUpperCase() : '';
    const rawNum = p?.number;
    const num = typeof rawNum === 'number' ? Math.trunc(rawNum)
      : typeof rawNum === 'string' && /^\d+$/.test(rawNum) ? parseInt(rawNum, 10) : null;
    if (!name || !position || position.length > 4 || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    players.push({ name, position, number: num != null && num >= 1 && num <= 99 ? num : null, starter: p?.starter === true });
  }
  return { manager, formation, players };
}

/** Normalize a player name for matching: strip diacritics, lowercase, collapse non-alphanumerics. */
function normName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export interface RosterPlayer { id: bigint; name: string }
export interface PlayerUpdate { id: bigint; position: string; number: number | null; isStarter: boolean }

/** Map LLM lineup assignments onto an existing roster by normalized name. Pure. Each roster player
 *  matched at most once; assignments with no roster match are dropped (never invent rows); roster
 *  players with no assignment produce no update (they stay non-starters after the caller's reset). */
export function applyLineupAssignments(roster: RosterPlayer[], assignments: CrawledPlayer[]): PlayerUpdate[] {
  const byNorm = new Map<string, RosterPlayer>();
  for (const p of roster) byNorm.set(normName(p.name), p);
  const used = new Set<bigint>();
  const updates: PlayerUpdate[] = [];
  for (const a of assignments) {
    const match = byNorm.get(normName(a.name));
    if (!match || used.has(match.id)) continue;
    used.add(match.id);
    updates.push({ id: match.id, position: a.position, number: a.number, isStarter: a.starter });
  }
  return updates;
}

/** Crawl one team's lineup via the gateway. Grounded prompt; JSON-object output. */
export async function crawlLineup(
  gateway: LlmGateway,
  team: { name: string; model?: string },
): Promise<CrawledLineup> {
  const messages = [
    { role: 'system' as const, content: 'You are a football data assistant. Output ONLY a JSON object — no prose, no code fences.' },
    {
      role: 'user' as const,
      content:
        `Give the projected ${team.name} men's national team lineup for the 2026 World Cup. ` +
        `Use REAL, currently-active internationals only — do NOT invent names. ` +
        `Return JSON: {"manager":"<head coach full name>","formation":"<e.g. 4-2-3-1>","players":[` +
        `{"number":<shirt number or null>,"name":"<full name>","position":"<specific: GK,RB,CB,LB,RWB,LWB,CDM,CM,CAM,RM,LM,RW,LW,ST,CF>","starter":<boolean>}]}. ` +
        `Include ~23 players: exactly 11 with starter:true forming the formation, the rest starter:false (bench).`,
    },
  ];
  const raw = await gateway.complete({ messages, model: team.model });
  return parseLineupJson(raw);
}

/** Enrich a team's REAL roster: the LLM annotates the given names with a best projected XI
 *  (specific position + 11 starters + formation + numbers). Roster names are an INPUT (never invented). */
export async function enrichLineup(
  gateway: LlmGateway,
  team: { name: string; players: string[]; model?: string },
): Promise<CrawledLineup> {
  const roster = team.players.join(', ');
  const messages = [
    { role: 'system' as const, content: 'You are a football data assistant. Output ONLY a JSON object — no prose, no code fences.' },
    {
      role: 'user' as const,
      content:
        `Here is ${team.name}'s squad for the 2026 World Cup: ${roster}. ` +
        `Using ONLY these exact players (do not add, drop, or rename anyone), pick the team's strongest projected ` +
        `starting XI and assign EVERY squad member a specific position. ` +
        `Return JSON: {"manager":"<head coach full name>","formation":"<e.g. 4-2-3-1>","players":[` +
        `{"number":<shirt number or null>,"name":"<exact name from the list>","position":"<specific: GK,RB,CB,LB,RWB,LWB,CDM,CM,CAM,RM,LM,RW,LW,ST,CF>","starter":<boolean>}]}. ` +
        `Set starter:true for exactly 11 forming the formation; starter:false for the rest. Include every listed player exactly once.`,
    },
  ];
  const raw = await gateway.complete({ messages, model: team.model });
  return parseLineupJson(raw);
}

/** Enrich + store ONE team's lineup. Loads the FD-synced roster; if empty → 'no-roster' (no LLM call).
 *  Resets starters, applies name-matched assignments, sets Team.formation/manager. Never adds/removes players. */
export async function enrichAndStoreLineup(
  prisma: PrismaClient,
  gateway: LlmGateway,
  teamId: bigint,
): Promise<{ team: string; matched: number; starters: number; status: string }> {
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { id: true, name: true } });
  if (!team) throw new Error('TEAM_NOT_FOUND');
  const roster = await prisma.player.findMany({ where: { teamId }, select: { id: true, name: true } });
  if (roster.length === 0) return { team: team.name, matched: 0, starters: 0, status: 'no-roster' };

  const t0 = Date.now();
  let lineup: CrawledLineup = { manager: '', formation: '', players: [] };
  let status = 'ok';
  try {
    lineup = await enrichLineup(gateway, { name: team.name, players: roster.map((p) => p.name) });
    if (lineup.players.length === 0) status = 'empty';
  } catch {
    status = 'error';
  }
  await prisma.aiJob.create({ data: { type: 'squad', providerUsed: 'gateway', status, latencyMs: Date.now() - t0 } });
  if (lineup.players.length === 0) return { team: team.name, matched: 0, starters: 0, status };

  const updates = applyLineupAssignments(roster, lineup.players);
  await prisma.$transaction([
    prisma.player.updateMany({ where: { teamId }, data: { isStarter: false } }),
    ...updates.map((u) =>
      prisma.player.update({ where: { id: u.id }, data: { position: u.position, number: u.number ?? undefined, isStarter: u.isStarter } }),
    ),
    prisma.team.update({ where: { id: teamId }, data: { formation: lineup.formation || null, manager: lineup.manager || null } }),
  ]);
  return { team: team.name, matched: updates.length, starters: updates.filter((u) => u.isStarter).length, status };
}

/** Enrich every team's lineup (bulk). Sequential — each is one LLM call. */
export async function enrichAllLineups(
  prisma: PrismaClient,
  gateway: LlmGateway,
): Promise<{ team: string; matched: number; starters: number; status: string }[]> {
  const teams = await prisma.team.findMany({ select: { id: true }, orderBy: { name: 'asc' } });
  const out: { team: string; matched: number; starters: number; status: string }[] = [];
  for (const t of teams) out.push(await enrichAndStoreLineup(prisma, gateway, t.id));
  return out;
}

export interface SquadTeam { id: bigint; name: string }

/**
 * Crawl + store lineups for the given teams. Per team: crawl → validate → replace Player rows
 * (position=specific, isStarter) + set Team.formation/manager → log an AiJob. A team whose crawl
 * fails/returns nothing is left untouched.
 */
export async function crawlAndStoreSquads(
  prisma: PrismaClient,
  gateway: LlmGateway,
  teams: SquadTeam[],
): Promise<{ team: string; count: number; starters: number; status: string }[]> {
  const results: { team: string; count: number; starters: number; status: string }[] = [];
  for (const t of teams) {
    const t0 = Date.now();
    let lineup: CrawledLineup = { manager: '', formation: '', players: [] };
    let status = 'ok';
    try {
      lineup = await crawlLineup(gateway, { name: t.name });
      if (lineup.players.length === 0) status = 'empty';
    } catch {
      status = 'error';
    }
    await prisma.aiJob.create({ data: { type: 'squad', providerUsed: 'gateway', status, latencyMs: Date.now() - t0 } });
    if (lineup.players.length > 0) {
      await prisma.$transaction([
        prisma.player.deleteMany({ where: { teamId: t.id } }),
        prisma.player.createMany({
          data: lineup.players.map((p) => ({ teamId: t.id, name: p.name, position: p.position, number: p.number ?? undefined, isStarter: p.starter })),
        }),
        prisma.team.update({ where: { id: t.id }, data: { formation: lineup.formation || null, manager: lineup.manager || null } }),
      ]);
    }
    results.push({ team: t.name, count: lineup.players.length, starters: lineup.players.filter((p) => p.starter).length, status });
  }
  return results;
}
