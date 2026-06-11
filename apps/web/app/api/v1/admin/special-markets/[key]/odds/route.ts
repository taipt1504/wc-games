import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSpecialOdds } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';
const Schema = z.object({ oddsYes: z.coerce.number().positive(), oddsNo: z.coerce.number().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { key } = await params;
  try {
    await setSpecialOdds(prisma, key, parsed.data);
  } catch { return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 }); }
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'SET_SPECIAL_ODDS', target: `special:${key}`, metadata: parsed.data } });
  return NextResponse.json({ data: parsed.data });
}
