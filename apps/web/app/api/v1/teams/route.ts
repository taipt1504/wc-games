import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/teams[?group=A] — public team list (real WC2026 data, DATA SD §8).
export async function GET(req: Request) {
  const group = new URL(req.url).searchParams.get('group');
  const teams = await prisma.team.findMany({
    where: group ? { group: { name: group } } : undefined,
    include: { group: { select: { name: true } }, _count: { select: { players: true } } },
    orderBy: [{ group: { name: 'asc' } }, { name: 'asc' }],
  });
  const data = teams.map((t) => ({
    id: Number(t.id), name: t.name, code: t.code, flagUrl: t.flagUrl, fifaRank: t.fifaRank,
    group: t.group?.name ?? null, playerCount: t._count.players,
  }));
  return NextResponse.json({ data });
}
