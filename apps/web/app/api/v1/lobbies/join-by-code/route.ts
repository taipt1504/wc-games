import { NextResponse } from 'next/server';
import { joinLobby } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { verifyLobbyPassword, parseInviteCode } from '@/lib/lobby';

export const dynamic = 'force-dynamic';

// POST /api/v1/lobbies/join-by-code — resolve an invite code or pasted link, gate on password, join.
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => ({})) as { code?: string; password?: string };
  const token = parseInviteCode(body.code ?? '');
  if (!token) return NextResponse.json({ error: { code: 'INVALID_CODE' } }, { status: 400 });

  const lobby = await prisma.lobby.findUnique({ where: { inviteToken: token }, select: { id: true, name: true, passwordHash: true } });
  if (!lobby) return NextResponse.json({ error: { code: 'INVALID_CODE' } }, { status: 404 });

  const check = await verifyLobbyPassword(lobby, body.password);
  if (check !== 'OK') return NextResponse.json({ error: { code: check } }, { status: 401 });

  try {
    await joinLobby(prisma, lobby.id, user.id);
    return NextResponse.json({ data: { id: Number(lobby.id), name: lobby.name } }, { status: 201 });
  } catch (e) {
    if ((e as Error).message === 'ALREADY_MEMBER') {
      return NextResponse.json({ data: { id: Number(lobby.id), name: lobby.name, alreadyMember: true } });
    }
    throw e;
  }
}
