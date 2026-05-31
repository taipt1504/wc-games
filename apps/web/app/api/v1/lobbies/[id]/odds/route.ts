import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setLobbyOdds, listLobbyOdds } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET — list all lobby odds overrides (any member may call)
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  const data = await listLobbyOdds(prisma, BigInt(id));
  return NextResponse.json({ data });
}

const OddsSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  mHome: z.number().positive(),
  mDraw: z.number().positive(),
  mAway: z.number().positive(),
});

// POST — set/override lobby odds for a match (only the lobby owner)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = OddsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  try {
    const row = await setLobbyOdds(prisma, BigInt(id), user.id, BigInt(parsed.data.matchId), {
      mHome: parsed.data.mHome,
      mDraw: parsed.data.mDraw,
      mAway: parsed.data.mAway,
    });
    return NextResponse.json({ data: { id: Number(row.id), matchId: Number(row.matchId), mHome: Number(row.mHome), mDraw: Number(row.mDraw), mAway: Number(row.mAway) } });
  } catch (e) {
    if ((e as Error).message === 'NOT_OWNER') {
      return NextResponse.json({ error: { code: 'NOT_OWNER' } }, { status: 403 });
    }
    throw e;
  }
}
