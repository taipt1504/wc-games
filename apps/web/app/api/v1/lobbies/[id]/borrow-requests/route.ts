import { NextResponse } from 'next/server';
import { z } from 'zod';
import { decideBorrow, getLobbyStanding } from '@wc/lobby';
import { notify } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET — pending borrow requests for the lobby (host only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  if (lobby.ownerId !== user.id) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const requests = await prisma.borrowRequest.findMany({
    where: { lobbyId, status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  // Batch-load memberships and users
  const membershipIds = [...new Set(requests.map((r) => r.membershipId))];
  const memberships = await prisma.lobbyMembership.findMany({
    where: { id: { in: membershipIds } },
    include: { user: { select: { id: true, username: true, email: true } } },
  });
  const membershipById = new Map(memberships.map((m) => [m.id, m]));

  const data = await Promise.all(
    requests.map(async (r) => {
      const membership = membershipById.get(r.membershipId);
      const who = membership?.user.username || membership?.user.email.split('@')[0] || 'member';
      const userId = membership?.userId ?? 0n;

      const wallet = await prisma.wallet.findFirst({
        where: { userId, contextType: 'LOBBY', contextId: lobbyId },
      });
      const balance = Number(wallet?.balance ?? 0);
      const standing = userId ? await getLobbyStanding(prisma, lobbyId, userId) : { score: 0 };
      const t = r.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

      return {
        id: Number(r.id),
        who,
        amount: Number(r.amount),
        balance,
        t,
        score: standing.score,
      };
    }),
  );

  return NextResponse.json({ data });
}

const DecideSchema = z.object({
  approve: z.boolean(),
});

// POST /borrow-requests?requestId=X — host approves or declines a request.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  const lobby = await prisma.lobby.findUnique({ where: { id: lobbyId } });
  if (!lobby) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  if (lobby.ownerId !== user.id) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const url = new URL(req.url);
  const requestId = url.searchParams.get('requestId');
  if (!requestId) return NextResponse.json({ error: { code: 'MISSING_REQUEST_ID' } }, { status: 422 });

  const body = await req.json().catch(() => null);
  const parsed = DecideSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    const result = await decideBorrow(prisma, BigInt(requestId), parsed.data.approve, user.id);
    // Notify the borrower of the decision (best-effort).
    const br = await prisma.borrowRequest.findUnique({ where: { id: BigInt(requestId) } });
    if (br) {
      const m = await prisma.lobbyMembership.findUnique({ where: { id: br.membershipId }, select: { userId: true } });
      if (m) await notify(prisma, m.userId, 'borrow', { event: parsed.data.approve ? 'approved' : 'declined', lobbyId: Number(lobbyId), amount: Number(br.amount) });
    }
    return NextResponse.json({ data: result });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'ALREADY_DECIDED') return NextResponse.json({ error: { code: 'ALREADY_DECIDED' } }, { status: 409 });
    throw e;
  }
}
