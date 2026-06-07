import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishEvent, channels } from '@wc/realtime';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({ locked: z.boolean() });

// POST /api/v1/admin/matches/[id]/lock-betting — admin blocks/unblocks betting on a match (PRD §09).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { id } = await params;

  await prisma.match.update({ where: { id: BigInt(id) }, data: { bettingLocked: parsed.data.locked } });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'LOCK_BETTING', target: `match:${id}`, metadata: { locked: parsed.data.locked } },
  });
  await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) });
  return NextResponse.json({ data: { id: Number(id), bettingLocked: parsed.data.locked } });
}
