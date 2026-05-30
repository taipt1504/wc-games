import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

// POST — ban a user (admin only) + write an audit entry. PRD §09 ADMIN-03 / §16.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  await prisma.user.update({ where: { id: BigInt(id) }, data: { status: 'BANNED' } });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'BAN_USER', target: `user:${id}` },
  });
  return NextResponse.json({ data: { ok: true } });
}
