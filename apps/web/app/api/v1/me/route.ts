import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const [wallet, stats, streakRow] = await Promise.all([
    prisma.wallet.findFirst({ where: { userId: user.id, contextType: 'GLOBAL', contextId: null } }),
    prisma.predictionUserStats.findUnique({ where: { userId: user.id } }),
    prisma.streak.findUnique({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      role: user.role,
      balance: wallet ? Number(wallet.balance) : 0,
      settled: stats?.settledCount ?? 0,
      won: stats?.winCount ?? 0,
      winStreak: streakRow?.winStreak ?? 0,
    },
  });
}
