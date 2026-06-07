import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().min(2).max(8).optional(),
  flagUrl: z.string().url().max(500).optional(),
}).refine((o) => Object.keys(o).length > 0, { message: 'no fields to update' });

// PATCH /api/v1/admin/teams/[id] — manual team metadata edit (admin only). PRD §09.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  const team = await prisma.team.findUnique({ where: { id: BigInt(id) } });
  if (!team) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const updated = await prisma.team.update({ where: { id: BigInt(id) }, data: parsed.data });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'EDIT_TEAM', target: `team:${id}`, metadata: parsed.data },
  });
  return NextResponse.json({ data: { id: Number(updated.id), name: updated.name, code: updated.code, flagUrl: updated.flagUrl } });
}
