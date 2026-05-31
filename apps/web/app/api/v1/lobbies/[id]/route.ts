import { NextResponse } from 'next/server';
import { getLobbyStanding } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/lobbies/[id] — lobby detail with board, gated to members.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  const lobby = await prisma.lobby.findUnique({
    where: { id: lobbyId },
    include: { memberships: { include: { user: { select: { id: true, username: true, email: true } } } } },
  });
  if (!lobby) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  // Membership gate
  const myMembership = lobby.memberships.find((m) => m.userId === user.id);
  if (!myMembership) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const isHost = lobby.ownerId === user.id;

  // Resolve owner display name
  const ownerMembership = lobby.memberships.find((m) => m.userId === lobby.ownerId);
  const ownerName = ownerMembership?.user.username || ownerMembership?.user.email.split('@')[0] || 'host';

  // Derive matchIds from scope
  let matchIds: number[] = [];
  if (lobby.scope === 'MATCH' && lobby.scopeRefId) {
    matchIds = [Number(lobby.scopeRefId)];
  } else if (lobby.scope !== 'ALL') {
    const roundMap: Record<string, string> = {
      GROUP: 'GROUP', R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', FINAL: 'FINAL',
    };
    const round = roundMap[lobby.scope];
    if (round) {
      const mRows = await prisma.match.findMany({ where: { round: round as never }, select: { id: true } });
      matchIds = mRows.map((m) => Number(m.id));
    }
  } else {
    const mRows = await prisma.match.findMany({ select: { id: true } });
    matchIds = mRows.map((m) => Number(m.id));
  }

  // Build board: compute standing per member
  const boardRows = await Promise.all(
    lobby.memberships.map(async (m) => {
      const standing = await getLobbyStanding(prisma, lobbyId, m.userId);
      const name = m.user.username || m.user.email.split('@')[0] || 'member';
      return {
        userId: Number(m.userId),
        name,
        score: standing.score,
        won: Number(standing.winnings),
        def: Number(standing.defaultPoints),
        borrowed: Number(standing.borrowed),
        you: m.userId === user.id,
      };
    }),
  );

  // Sort board by score desc, assign rank
  boardRows.sort((a, b) => b.score - a.score);
  const board = boardRows.map((r, i) => ({ ...r, rank: i + 1 }));

  const myRank = board.find((r) => r.you)?.rank ?? null;

  const data = {
    id: Number(lobby.id),
    name: lobby.name ?? 'Lobby',
    scope: lobby.scope,
    owner: ownerName,
    isHost,
    members: lobby.memberships.length,
    def: Number(lobby.defaultPoints),
    borrow: lobby.allowBorrow,
    pwd: !!lobby.passwordHash,
    hot: false,
    joined: true,
    public: !lobby.passwordHash,
    code: lobby.inviteToken,
    matchIds,
    you: myRank,
    board,
  };

  return NextResponse.json({ data });
}
