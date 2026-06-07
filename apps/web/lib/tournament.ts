import { prisma } from '@/lib/db';
import type { Outcome } from '@wc/db';

/** Outcome enum → 1X2 pick code used by the UI. */
export function outcomeToPick(o: Outcome | null): '1' | 'X' | '2' | null {
  return o === 'HOME' ? '1' : o === 'DRAW' ? 'X' : o === 'AWAY' ? '2' : null;
}

export interface TeamLite { id: number; name: string; code: string | null; flagUrl: string | null }

/** Map of teamId → lite team, for attaching teams to matches (Match has no Team FK relation). */
export async function teamMap(): Promise<Map<number, TeamLite>> {
  const teams = await prisma.team.findMany({ select: { id: true, name: true, code: true, flagUrl: true } });
  return new Map(teams.map((t) => [Number(t.id), { id: Number(t.id), name: t.name, code: t.code, flagUrl: t.flagUrl }]));
}

export interface StandingRow {
  id: number; name: string; code: string | null; flagUrl: string | null;
  played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; pts: number;
}

/** Group standings computed from FINISHED group matches (PRD §15: standings derived from results). */
export async function groupStandings(): Promise<{ name: string; teams: StandingRow[] }[]> {
  const groups = await prisma.group.findMany({
    orderBy: { name: 'asc' },
    include: { teams: { select: { id: true, name: true, code: true, flagUrl: true } } },
  });
  const finished = await prisma.match.findMany({
    where: { round: 'GROUP', status: 'FINISHED' },
    select: { homeTeamId: true, awayTeamId: true, scoreHome90: true, scoreAway90: true },
  });

  const rows = new Map<number, StandingRow>();
  for (const g of groups) {
    for (const t of g.teams) {
      rows.set(Number(t.id), { id: Number(t.id), name: t.name, code: t.code, flagUrl: t.flagUrl, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0 });
    }
  }
  for (const m of finished) {
    const h = rows.get(Number(m.homeTeamId));
    const a = rows.get(Number(m.awayTeamId));
    if (!h || !a || m.scoreHome90 == null || m.scoreAway90 == null) continue;
    const hs = m.scoreHome90, as = m.scoreAway90;
    h.played++; a.played++; h.gf += hs; h.ga += as; a.gf += as; a.ga += hs;
    if (hs > as) { h.won++; h.pts += 3; a.lost++; }
    else if (hs < as) { a.won++; a.pts += 3; h.lost++; }
    else { h.drawn++; a.drawn++; h.pts++; a.pts++; }
  }
  for (const r of rows.values()) r.gd = r.gf - r.ga;

  return groups.map((g) => ({
    name: g.name,
    teams: g.teams
      .map((t) => rows.get(Number(t.id))!)
      .sort((x, y) => y.pts - x.pts || y.gd - x.gd || y.gf - x.gf || x.name.localeCompare(y.name)),
  }));
}
