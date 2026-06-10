import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/scorers — Top Scorers (Golden Boot), ordered by goals then assists. Public read.
export async function GET() {
  const rows = await prisma.scorer.findMany({
    orderBy: [{ goals: 'desc' }, { assists: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, teamId: true, teamName: true, goals: true, assists: true, penalties: true },
  });
  const data = rows.map((r, i) => ({
    rank: i + 1,
    id: Number(r.id),
    name: r.name,
    teamId: r.teamId != null ? Number(r.teamId) : null,
    teamName: r.teamName,
    goals: r.goals,
    assists: r.assists,
    penalties: r.penalties,
  }));
  return NextResponse.json({ data });
}
