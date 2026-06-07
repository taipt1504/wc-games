import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeLobbyBet } from '@wc/lobby';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const BetSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  outcome: z.enum(['1', 'X', '2']),
  stake: z.number().int().positive(),
});

// POST — place a lobby-context bet (any lobby member)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = BetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }
  try {
    const prediction = await placeLobbyBet(prisma, {
      lobbyId: BigInt(id),
      userId: user.id,
      matchId: BigInt(parsed.data.matchId),
      pick: parsed.data.outcome,
      stake: BigInt(parsed.data.stake),
    });
    return NextResponse.json({ data: { id: Number(prediction.id), outcome: prediction.outcome, stake: Number(prediction.stake), status: prediction.status } }, { status: 201 });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === 'NOT_A_MEMBER') return NextResponse.json({ error: { code: 'NOT_A_MEMBER' } }, { status: 403 });
    if (msg === 'ALREADY_BET_OUTCOME') return NextResponse.json({ error: { code: 'ALREADY_BET_OUTCOME' } }, { status: 409 });
    if (msg === 'BET_LOCKED') return NextResponse.json({ error: { code: 'BET_LOCKED' } }, { status: 409 });
    if (msg === 'ODDS_UNAVAILABLE') return NextResponse.json({ error: { code: 'ODDS_UNAVAILABLE' } }, { status: 409 });
    if (msg === 'INSUFFICIENT_BALANCE') return NextResponse.json({ error: { code: 'INSUFFICIENT_BALANCE' } }, { status: 422 });
    throw e;
  }
}
