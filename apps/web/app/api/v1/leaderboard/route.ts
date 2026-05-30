import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getGlobalLeaderboard } from '@wc/prediction';

export const dynamic = 'force-dynamic';

const TIERS = ['Legend', 'Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

// Global ROI leaderboard in the UI shape ({ rank, name, roi%, net, settled, won, tier }).
// minSettled defaults to 1 here so early data surfaces; PRD production default is 10 (OQ-04).
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

  const data = board.map((b, i) => ({
    rank: b.rank,
    name: nameOf(b.userId),
    roi: Math.round(b.roi * 1000) / 10, // fraction -> percent (1 decimal)
    net: b.netProfit,
    settled: b.settledCount,
    won: b.winCount,
    tier: TIERS[Math.min(i, TIERS.length - 1)],
  }));
  return NextResponse.json({ data });
}
