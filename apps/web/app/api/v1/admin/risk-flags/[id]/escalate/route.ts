import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — escalate a risk flag (admin only). ADMIN-03.
// :id = RiskFlag id (not the lobby id)
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const { id } = await params;
  const flagId = BigInt(id);

  const flag = await prisma.riskFlag.findUnique({ where: { id: flagId } });
  if (!flag) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  await prisma.$transaction([
    prisma.moderationAction.create({
      data: {
        adminId: admin.id,
        targetType: 'LOBBY',
        targetId: flag.targetId,
        action: 'ESCALATE',
      },
    }),
    prisma.auditLog.create({
      data: {
        actorType: 'ADMIN',
        actorId: admin.id,
        action: 'ESCALATE',
        target: `risk-flag:${id}`,
      },
    }),
  ]);

  return NextResponse.json({ data: { ok: true } });
}
