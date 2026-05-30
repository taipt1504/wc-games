import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createLobby } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const SCOPE_MAP: Record<string, 'ALL' | 'GROUP' | 'R32' | 'R16' | 'QF' | 'SF' | 'FINAL' | 'MATCH'> = {
  all: 'ALL', group: 'GROUP', r32: 'R32', r16: 'R16', qf: 'QF', sf: 'SF', final: 'FINAL', custom: 'MATCH',
};

// GET — list lobbies in the UI Lobby shape (joined flag relative to the session user).
export async function GET() {
  const user = await getSessionUser();
  const myIds = new Set<number>();
  if (user) {
    const ms = await prisma.lobbyMembership.findMany({ where: { userId: user.id }, select: { lobbyId: true } });
    ms.forEach((m) => myIds.add(Number(m.lobbyId)));
  }
  const lobbies = await prisma.lobby.findMany({
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: { _count: { select: { memberships: true } } },
  });
  const owners = await prisma.user.findMany({
    where: { id: { in: lobbies.map((l) => l.ownerId) } },
    select: { id: true, email: true, username: true },
  });
  const ownerName = (id: bigint) => {
    const u = owners.find((x) => x.id === id);
    return u?.username || u?.email.split('@')[0] || 'host';
  };
  const data = lobbies.map((l) => ({
    id: Number(l.id),
    name: l.name ?? 'Lobby',
    scope: l.scope,
    members: l._count.memberships,
    you: myIds.has(Number(l.id)) ? 1 : null,
    def: Number(l.defaultPoints),
    owner: ownerName(l.ownerId),
    borrow: l.allowBorrow,
    pwd: !!l.passwordHash,
    hot: false,
    joined: myIds.has(Number(l.id)),
    public: !l.passwordHash,
    code: l.inviteToken,
    matchIds: [] as number[],
  }));
  return NextResponse.json({ data });
}

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  scope: z.string().optional(),
  defaultPoints: z.coerce.number().int().positive().max(1_000_000).default(1000),
});

// POST — create a lobby (session user becomes owner).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  const inviteToken = globalThis.crypto.randomUUID().slice(0, 8).toUpperCase();
  const lobby = await createLobby(prisma, user.id, {
    name: parsed.data.name,
    scope: SCOPE_MAP[parsed.data.scope ?? 'all'] ?? 'ALL',
    defaultPoints: BigInt(parsed.data.defaultPoints),
    inviteToken,
  });
  return NextResponse.json({ data: { id: Number(lobby.id), name: lobby.name, code: lobby.inviteToken } }, { status: 201 });
}
