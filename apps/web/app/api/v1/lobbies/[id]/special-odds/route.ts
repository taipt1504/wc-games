import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setSpecialLobbyOdds } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';
const Schema = z.object({ marketKey: z.string().min(1), oddsYes: z.number().positive(), oddsNo: z.number().positive() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { id } = await params;
  try {
    const row = await setSpecialLobbyOdds(prisma, BigInt(id), user.id, parsed.data.marketKey, { oddsYes: parsed.data.oddsYes, oddsNo: parsed.data.oddsNo });
    return NextResponse.json({ data: { oddsYes: Number(row.oddsYes), oddsNo: Number(row.oddsNo) } });
  } catch (e) {
    if ((e as Error).message === 'NOT_OWNER') return NextResponse.json({ error: { code: 'NOT_OWNER' } }, { status: 403 });
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }
}
