import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — close a lobby + resolve its open risk flags (admin only). ADMIN-03.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  await prisma.$transaction([
    prisma.lobby.update({ where: { id: lobbyId }, data: { status: 'CLOSED' } }),
    prisma.riskFlag.updateMany({
      where: { targetType: 'LOBBY', targetId: lobbyId, status: 'OPEN' },
      data: { status: 'RESOLVED' },
    }),
    prisma.moderationAction.create({
      data: {
        adminId: admin.id,
        targetType: 'LOBBY',
        targetId: lobbyId,
        action: 'CLOSE_LOBBY',
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'CLOSE_LOBBY',
        target: `lobby:${id}`,
      },
    }),
  ]);

  return NextResponse.json({ data: { ok: true } });
}
