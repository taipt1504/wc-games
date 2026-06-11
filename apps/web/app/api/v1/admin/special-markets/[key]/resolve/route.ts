import { NextResponse } from 'next/server';
import { z } from 'zod';
import { resolveSpecialMarket } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';
const Schema = z.object({ outcome: z.enum(['YES', 'NO']) });

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { key } = await params;
  let r;
  try { r = await resolveSpecialMarket(prisma, key, parsed.data.outcome); }
  catch { return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }); }
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'RESOLVE_SPECIAL', target: `special:${key}`, metadata: { outcome: parsed.data.outcome, settled: r.settled } } });
  return NextResponse.json({ data: r });
}
