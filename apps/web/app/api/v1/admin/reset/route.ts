import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

const Schema = z.object({ confirm: z.literal('RESET') });

// POST /api/v1/admin/reset — wipe all test betting data + reset fixtures to a clean pre-tournament
// state (PRD §09 admin). DESTRUCTIVE; requires { confirm: "RESET" }. Clears bets/settlements/ledger/
// stats/parlays/duels, returns every match to SCHEDULED (scores/result cleared, betting open), and
// resets GLOBAL wallets to the 1,000-pt starting balance. Does NOT touch users, teams, players,
// lobbies or news. Records an audit row.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'CONFIRM_REQUIRED' } }, { status: 422 });

  const result = await prisma.$transaction(async (tx) => {
    await tx.parlayLeg.deleteMany();
    await tx.parlay.deleteMany();
    const preds = await tx.prediction.deleteMany();
    await tx.settlement.deleteMany();
    await tx.pointLedger.deleteMany();
    await tx.predictionUserStats.deleteMany();
    await tx.duel.deleteMany();
    const matches = await tx.match.updateMany({
      data: { status: 'SCHEDULED', scoreHome90: null, scoreAway90: null, result90: null, bettingLocked: false, source: 'API' },
    });
    const wallets = await tx.wallet.updateMany({ where: { contextType: 'GLOBAL' }, data: { balance: 1000n } });
    return { predictionsCleared: preds.count, matchesReset: matches.count, walletsReset: wallets.count };
  });

  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'RESET_TOURNAMENT', target: 'tournament', metadata: result },
  });
  return NextResponse.json({ data: result });
}
