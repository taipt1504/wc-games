import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishEvent, channels } from '@wc/realtime';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({
  mHome: z.coerce.number().positive(),
  mDraw: z.coerce.number().positive(),
  mAway: z.coerce.number().positive(),
  reason: z.string().min(1),
});

// POST /api/v1/admin/matches/[id]/odds — admin sets house odds (source=ADMIN). Open bets keep their snapshot.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { id } = await params;
  const { mHome, mDraw, mAway, reason } = parsed.data;

  await prisma.matchOdds.upsert({
    where: { matchId: BigInt(id) },
    update: { mHome, mDraw, mAway, source: 'ADMIN' },
    create: { matchId: BigInt(id), mHome, mDraw, mAway, source: 'ADMIN' },
  });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'EDIT_ODDS', target: `match:${id}`, metadata: { mHome, mDraw, mAway, reason } },
  });
  await publishEvent(channels.matches, { type: 'match.update', matchId: Number(id) });
  return NextResponse.json({ data: { mHome, mDraw, mAway } });
}
