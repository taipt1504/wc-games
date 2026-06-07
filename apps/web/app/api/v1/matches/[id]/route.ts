import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { teamMap, outcomeToPick } from '@/lib/tournament';

export const dynamic = 'force-dynamic';

// GET /api/v1/matches/[id] — single fixture with teams, venue + house odds.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let matchId: bigint;
  try { matchId = BigInt(id); } catch { return NextResponse.json({ error: { code: 'BAD_ID' } }, { status: 400 }); }

  const match = await prisma.match.findUnique({ where: { id: matchId }, include: { odds: true } });
  if (!match) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const [teams, venue, group] = await Promise.all([
    teamMap(),
    match.venueId ? prisma.venue.findUnique({ where: { id: match.venueId } }) : Promise.resolve(null),
    match.groupId ? prisma.group.findUnique({ where: { id: match.groupId }, select: { name: true } }) : Promise.resolve(null),
  ]);

  return NextResponse.json({
    data: {
      id: Number(match.id), round: match.round, group: group?.name ?? null, status: match.status,
      kickoffAt: match.kickoffAt, bettingLocked: match.bettingLocked,
      home: teams.get(Number(match.homeTeamId)) ?? null,
      away: teams.get(Number(match.awayTeamId)) ?? null,
      scoreHome: match.scoreHome90, scoreAway: match.scoreAway90, result: outcomeToPick(match.result90),
      venue: venue ? { id: Number(venue.id), name: venue.name, city: venue.city, country: venue.country } : null,
      odds: match.odds ? { mHome: Number(match.odds.mHome), mDraw: Number(match.odds.mDraw), mAway: Number(match.odds.mAway) } : null,
    },
  });
}
