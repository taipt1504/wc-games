import { NextResponse } from 'next/server';
import type { Prisma, MatchRound } from '@wc/db';
import { prisma } from '@/lib/db';
import { teamMap, outcomeToPick } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

const ROUNDS = ['GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL'];

// GET /api/v1/matches[?team=&round=&date=YYYY-MM-DD] — fixtures with teams + house odds.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const where: Prisma.MatchWhereInput = {};

  const team = q.get('team');
  if (team && /^\d+$/.test(team)) where.OR = [{ homeTeamId: BigInt(team) }, { awayTeamId: BigInt(team) }];

  const round = q.get('round')?.toUpperCase();
  if (round && ROUNDS.includes(round)) where.round = round as MatchRound;

  const date = q.get('date');
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const start = new Date(`${date}T00:00:00.000Z`);
    where.kickoffAt = { gte: start, lt: new Date(start.getTime() + 86_400_000) };
  }

  const [matches, teams, groups] = await Promise.all([
    prisma.match.findMany({ where, orderBy: { kickoffAt: 'asc' }, include: { odds: true } }),
    teamMap(),
    prisma.group.findMany({ select: { id: true, name: true } }),
  ]);
  const groupName = new Map(groups.map((g) => [Number(g.id), g.name]));

  const data = matches.map((m) => ({
    id: Number(m.id), round: m.round, group: m.groupId ? groupName.get(Number(m.groupId)) ?? null : null,
    kickoffAt: m.kickoffAt, status: m.status, bettingLocked: m.bettingLocked,
    home: teams.get(Number(m.homeTeamId)) ?? null,
    away: teams.get(Number(m.awayTeamId)) ?? null,
    scoreHome: m.scoreHome90, scoreAway: m.scoreAway90, result: outcomeToPick(m.result90),
    odds: m.odds ? { mHome: Number(m.odds.mHome), mDraw: Number(m.odds.mDraw), mAway: Number(m.odds.mAway) } : null,
  }));
  return NextResponse.json({ data });
}
