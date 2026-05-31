import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resettleMatch } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({ home: z.number().int().min(0), away: z.number().int().min(0), reason: z.string().optional() });

// POST — admin score override + safe re-settle (PRD §09 ADMIN-04). Reverses the prior
// settlement and re-applies the corrected score; idempotent. Records source + reason in audit.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  const { id } = await params;
  const { home, away, reason } = parsed.data;

  const r = await resettleMatch(prisma, BigInt(id), { home, away });
  await prisma.match.update({ where: { id: BigInt(id) }, data: { source: 'ADMIN' } });
  await prisma.auditLog.create({
    data: {
      actorType: 'ADMIN', actorId: admin.id, action: 'RESETTLE_MATCH', target: `match:${id}`,
      metadata: { score: `${home}-${away}`, reversed: r.reversed, reason: reason ?? 'score correction' },
    },
  });
  return NextResponse.json({ data: { result: r.result, reversed: r.reversed, settledCount: r.settledCount } });
}
