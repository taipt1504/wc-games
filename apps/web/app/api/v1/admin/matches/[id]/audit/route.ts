import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/matches/[id]/audit — recent admin actions on this match.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const rows = await prisma.auditLog.findMany({
    where: { target: `match:${id}` },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, actorType: true, action: true, metadata: true, createdAt: true },
  });
  return NextResponse.json({ data: rows.map((r) => ({ id: Number(r.id), actorType: r.actorType, action: r.action, metadata: r.metadata, createdAt: r.createdAt })) });
}
