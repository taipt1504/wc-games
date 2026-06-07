import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';
const OUTCOME: Record<string, string> = { HOME: '1', DRAW: 'X', AWAY: '2' };

// GET /api/v1/admin/users/[id] — real user detail: profile, balance, recent ledger + bets, stats.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  let uid: bigint;
  try { uid = BigInt(id); } catch { return NextResponse.json({ error: { code: 'BAD_ID' } }, { status: 400 }); }

  const user = await prisma.user.findUnique({
    where: { id: uid },
    select: { id: true, email: true, username: true, displayName: true, role: true, status: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const [wallet, ledger, bets, stats] = await Promise.all([
    prisma.wallet.findFirst({ where: { userId: uid, contextType: 'GLOBAL', contextId: null }, select: { balance: true } }),
    prisma.pointLedger.findMany({ where: { userId: uid }, orderBy: { id: 'desc' }, take: 10, select: { type: true, amount: true, balanceAfter: true, createdAt: true } }),
    prisma.prediction.findMany({ where: { userId: uid, contextType: 'GLOBAL' }, orderBy: { createdAt: 'desc' }, take: 10, select: { matchId: true, outcome: true, stake: true, oddsSnapshot: true, status: true } }),
    prisma.predictionUserStats.findUnique({ where: { userId: uid } }),
  ]);

  const settled = stats?.settledCount ?? 0;
  const winRate = settled > 0 ? Math.round((stats!.winCount / settled) * 100) : null;
  const totalStaked = Number(stats?.totalStaked ?? 0);
  const roi = totalStaked > 0 ? Math.round(((Number(stats!.totalReturned) - totalStaked) / totalStaked) * 100) : null;

  return NextResponse.json({
    data: {
      id: Number(user.id), email: user.email, name: user.displayName ?? user.username ?? user.email,
      role: user.role, status: user.status, joined: user.createdAt,
      balance: Number(wallet?.balance ?? 0),
      winRate, roi, settled, won: stats?.winCount ?? 0,
      ledger: ledger.map((l) => ({ type: l.type, amount: Number(l.amount), balanceAfter: Number(l.balanceAfter), when: l.createdAt })),
      bets: bets.map((b) => ({ matchId: Number(b.matchId), pick: OUTCOME[b.outcome] ?? '1', stake: Number(b.stake), odds: Number(b.oddsSnapshot), status: b.status })),
    },
  });
}
