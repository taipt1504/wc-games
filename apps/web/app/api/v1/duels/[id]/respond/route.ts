import { NextRequest, NextResponse } from 'next/server';
import { respondDuel } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;
  const { accept } = (await req.json()) as { accept: boolean };

  try {
    const duel = await respondDuel(prisma, BigInt(id), user.id, accept);
    return NextResponse.json({ data: duel });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_OPPONENT') return NextResponse.json({ error: { code: msg } }, { status: 403 });
    if (msg === 'ALREADY_DECIDED') return NextResponse.json({ error: { code: msg } }, { status: 409 });
    throw e;
  }
}
