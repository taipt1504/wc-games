import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const OUTCOME_TO_PICK: Record<string, string> = { HOME: '1', DRAW: 'X', AWAY: '2' };

// Returns the user's GLOBAL bets in the UI Bet shape ({ mid, pick, stake, odds, status, payout }).
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const preds = await prisma.prediction.findMany({
    where: { userId: user.id, contextType: 'GLOBAL' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const data = preds.map((p) => ({
    mid: Number(p.matchId),
    pick: OUTCOME_TO_PICK[p.outcome] ?? '1',
    stake: Number(p.stake),
    odds: Number(p.oddsSnapshot),
    status: p.status,
    payout: Number(p.payout),
  }));
  return NextResponse.json({ data });
}
