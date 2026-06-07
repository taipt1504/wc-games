import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { teamMap, outcomeToPick } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

// GET /api/v1/teams/[id] — team detail: group, squad (players), and its fixtures.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let teamId: bigint;
  try { teamId = BigInt(id); } catch { return NextResponse.json({ error: { code: 'BAD_ID' } }, { status: 400 }); }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { group: { select: { name: true } }, players: { orderBy: { number: 'asc' } } },
  });
  if (!team) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const [matches, teams] = await Promise.all([
    prisma.match.findMany({
      where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
      orderBy: { kickoffAt: 'asc' },
    }),
    teamMap(),
  ]);

  return NextResponse.json({
    data: {
      id: Number(team.id), name: team.name, code: team.code, flagUrl: team.flagUrl,
      fifaRank: team.fifaRank, group: team.group?.name ?? null,
      formation: team.formation, manager: team.manager,
      players: team.players.map((p) => ({ name: p.name, position: p.position, number: p.number, starter: p.isStarter })),
      matches: matches.map((m) => ({
        id: Number(m.id), round: m.round, status: m.status, kickoffAt: m.kickoffAt,
        home: teams.get(Number(m.homeTeamId)) ?? null,
        away: teams.get(Number(m.awayTeamId)) ?? null,
        scoreHome: m.scoreHome90, scoreAway: m.scoreAway90, result: outcomeToPick(m.result90),
      })),
    },
  });
}
