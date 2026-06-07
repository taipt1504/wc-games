import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';
import { predictorTier, roiPercent } from '@wc/core';
import { getGlobalLeaderboard } from '@wc/prediction';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({ username: z.string().min(2).max(30) });

// PATCH /api/v1/me — edit profile display name (username). Unique → 409 on conflict.
export async function PATCH(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const username = parsed.data.username.trim();
  try {
    await prisma.user.update({ where: { id: user.id }, data: { username } });
    return NextResponse.json({ data: { username } });
  } catch (e) {
    if ((e as { code?: string }).code === 'P2002') return NextResponse.json({ error: { code: 'USERNAME_TAKEN' } }, { status: 409 });
    throw e;
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const [dbUser, wallet, stats, streakRow, board] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.wallet.findFirst({ where: { userId: user.id, contextType: 'GLOBAL', contextId: null } }),
    prisma.predictionUserStats.findUnique({ where: { userId: user.id } }),
    prisma.streak.findUnique({ where: { userId: user.id } }),
    getGlobalLeaderboard(prisma, { minSettled: 1, limit: 1000 }),
  ]);

  const name = dbUser?.username || user.email.split('@')[0];
  const avatar = name.slice(0, 2).toUpperCase();
  const settled = stats?.settledCount ?? 0;
  const won = stats?.winCount ?? 0;
  const roi = stats ? roiPercent(Number(stats.totalStaked), Number(stats.totalReturned)) : 0;
  const netProfit = stats ? Number(stats.totalReturned) - Number(stats.totalStaked) : 0;
  const { tier, next: tierNext, toNext: tierToNext } = predictorTier(netProfit);
  const rank = board.find((b) => b.userId === user.id)?.rank ?? null;

  return NextResponse.json({
    data: {
      id: user.id,
      email: user.email,
      name,
      handle: `@${name}`,
      avatar,
      role: user.role,
      balance: wallet ? Number(wallet.balance) : 0,
      settled,
      won,
      lost: Math.max(0, settled - won),
      roi: Math.round(roi * 1000) / 10, // fraction -> percent (1 decimal)
      rank,
      winStreak: streakRow?.winStreak ?? 0,
      tier,
      tierNext,
      tierToNext,
    },
  });
}
