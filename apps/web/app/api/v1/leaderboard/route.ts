import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getGlobalLeaderboard } from '@wc/prediction';
import { predictorTier } from '@wc/core';
import { SIGNUP_BONUS } from '@wc/auth';

export const dynamic = 'force-dynamic';

// Global net-profit leaderboard in the UI shape ({ rank, name, roi%, net, settled, won, tier }).
// roi% is bankroll growth (net ÷ 1000 signup grant) so it tracks the net-based rank; tier is the
// real predictorTier(net). minSettled defaults to 1 here so early data surfaces; PRD prod default 10 (OQ-04).
export async function GET(req: Request) {
  const url = new URL(req.url);
  const minSettled = Number(url.searchParams.get('minSettled') ?? '1');
  const board = await getGlobalLeaderboard(prisma, { minSettled, limit: 50 });
  if (!board.length) return NextResponse.json({ data: [] });

  const users = await prisma.user.findMany({
    where: { id: { in: board.map((b) => b.userId) } },
    select: { id: true, email: true, username: true },
  });
  const nameOf = (id: bigint) => {
    const u = users.find((x) => x.id === id);
    return u?.username || u?.email.split('@')[0] || 'player';
  };

  const data = board.map((b) => ({
    rank: b.rank,
    name: nameOf(b.userId),
    roi: Math.round((b.netProfit / Number(SIGNUP_BONUS)) * 1000) / 10, // bankroll growth %: net ÷ 1000 signup grant
    net: b.netProfit,
    settled: b.settledCount,
    won: b.winCount,
    tier: predictorTier(b.netProfit).tier,
  }));
  return NextResponse.json({ data });
}
