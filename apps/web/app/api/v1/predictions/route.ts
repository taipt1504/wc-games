import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeBet } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

// Place a 1X2 bet (GLOBAL context). Source of truth: Prediction Service Design UC-04.
const Schema = z.object({
  matchId: z.coerce.number().int().positive(),
  outcome: z.enum(['1', 'X', '2']),
  stake: z.coerce.number().int().positive(),
});

const ERR_STATUS: Record<string, number> = {
  MATCH_NOT_FOUND: 404,
  BET_LOCKED: 409,
  ODDS_UNAVAILABLE: 409,
  INSUFFICIENT_BALANCE: 422,
  INVALID_STAKE: 422,
};

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    const pred = await placeBet(prisma, {
      userId: user.id,
      matchId: BigInt(parsed.data.matchId),
      pick: parsed.data.outcome,
      stake: BigInt(parsed.data.stake),
    });
    return NextResponse.json(
      {
        data: {
          id: pred.id,
          status: pred.status,
          outcome: pred.outcome,
          stake: pred.stake,
          oddsSnapshot: pred.oddsSnapshot.toString(),
        },
      },
      { status: 201 },
    );
  } catch (e) {
    const code = (e as Error).message;
    const status = ERR_STATUS[code];
    if (status) return NextResponse.json({ error: { code } }, { status });
    throw e;
  }
}
