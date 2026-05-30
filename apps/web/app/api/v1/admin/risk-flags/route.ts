import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SCORE: Record<string, number> = { High: 87, Medium: 61, Low: 34 };

// GET — open risk flags (from the risk engine), in the UI RiskLobby shape.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const flags = await prisma.riskFlag.findMany({
    where: { targetType: 'LOBBY', status: 'OPEN' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  const lobbies = await prisma.lobby.findMany({
    where: { id: { in: flags.map((f) => f.targetId) } },
    include: { _count: { select: { memberships: true } } },
  });
  const data = flags.map((f) => {
    const l = lobbies.find((x) => x.id === f.targetId);
    return {
      id: Number(f.targetId),
      name: l?.name ?? `lobby ${f.targetId}`,
      members: l?._count.memberships ?? 0,
      risk: f.severity,
      score: SCORE[f.severity] ?? 34,
      reasons: f.rule.split('; '),
      flagged: 'flagged',
    };
  });
  return NextResponse.json({ data });
}
