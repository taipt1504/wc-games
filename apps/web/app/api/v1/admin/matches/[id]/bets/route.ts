import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PICK: Record<string, string> = { HOME: '1', DRAW: 'X', AWAY: '2' };

// GET /api/v1/admin/matches/[id]/bets — real bet exposure: per-outcome count / staked / liability.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const preds = await prisma.prediction.findMany({
    where: { matchId: BigInt(id), market: '1X2' },
    select: { outcome: true, stake: true, oddsSnapshot: true, status: true },
  });

  const agg: Record<string, { outcome: string; count: number; staked: number; liability: number }> = {
    '1': { outcome: '1', count: 0, staked: 0, liability: 0 },
    'X': { outcome: 'X', count: 0, staked: 0, liability: 0 },
    '2': { outcome: '2', count: 0, staked: 0, liability: 0 },
  };
  let total = 0, settled = 0;
  for (const p of preds) {
    const k = PICK[p.outcome] ?? '1';
    const stake = Number(p.stake);
    agg[k].count += 1;
    agg[k].staked += stake;
    agg[k].liability += Math.round(stake * (1 + Number(p.oddsSnapshot)));
    total += 1;
    if (p.status === 'WON' || p.status === 'LOST') settled += 1;
  }
  return NextResponse.json({ data: { outcomes: Object.values(agg), total, settled } });
}
