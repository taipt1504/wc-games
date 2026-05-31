import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({
  home: z.coerce.number().int().min(0),
  away: z.coerce.number().int().min(0),
  status: z.enum(['LIVE', 'FINISHED']).optional(),
});

// POST — push a live score into a match (DATA-07). Stand-in for the external real-time
// provider feed (deferred infra): a real feed would call this same update path.
// Does NOT settle — settlement stays the resettle / settlement-worker path.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  const { id } = await params;
  const { home, away, status } = parsed.data;
  await prisma.match.update({
    where: { id: BigInt(id) },
    data: { scoreHome90: home, scoreAway90: away, status: status ?? 'LIVE' },
  });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'LIVE_SCORE', target: `match:${id}` },
  });
  return NextResponse.json({ data: { ok: true } });
}
