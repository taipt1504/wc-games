import { NextResponse } from 'next/server';
import { joinLobby } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { verifyLobbyPassword } from '@/lib/lobby';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({})) as { password?: string };

  const lobby = await prisma.lobby.findUnique({ where: { id: BigInt(id) }, select: { passwordHash: true } });
  if (!lobby) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const check = await verifyLobbyPassword(lobby, body.password);
  if (check !== 'OK') return NextResponse.json({ error: { code: check } }, { status: 401 });

  try {
    await joinLobby(prisma, BigInt(id), user.id);
    return NextResponse.json({ data: { ok: true, id: Number(id) } }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'ALREADY_MEMBER') {
      return NextResponse.json({ error: { code: 'ALREADY_MEMBER' }, data: { id: Number(id) } }, { status: 409 });
    }
    throw e;
  }
}
