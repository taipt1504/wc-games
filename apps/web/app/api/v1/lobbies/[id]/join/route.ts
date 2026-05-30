import { NextResponse } from 'next/server';
import { joinLobby } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  try {
    await joinLobby(prisma, BigInt(id), user.id);
    return NextResponse.json({ data: { ok: true } }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: { code: 'ALREADY_MEMBER' } }, { status: 409 });
    }
    throw e;
  }
}
