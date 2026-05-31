import { NextRequest, NextResponse } from 'next/server';
import { createDuel, listDuels } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const data = await listDuels(prisma, user.id);
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { opponentId, scope } = (await req.json()) as { opponentId: string; scope: string };

  try {
    const duel = await createDuel(prisma, user.id, BigInt(opponentId), scope);
    return NextResponse.json({ data: duel }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'SELF_DUEL') {
      return NextResponse.json({ error: { code: 'SELF_DUEL' } }, { status: 422 });
    }
    throw e;
  }
}
