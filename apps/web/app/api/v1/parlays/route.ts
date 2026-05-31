import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeParlay } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

const Schema = z.object({
  stake: z.coerce.number().int().positive(),
  legs: z.array(
    z.object({
      matchId: z.coerce.number().int().positive(),
      outcome: z.enum(['HOME', 'DRAW', 'AWAY']),
    }),
  ).min(2),
});

const ERR_STATUS: Record<string, number> = {
  TOO_FEW_LEGS: 422,
  DUPLICATE_MATCH: 422,
  BET_LOCKED: 409,
  ODDS_UNAVAILABLE: 409,
  INSUFFICIENT_BALANCE: 422,
};

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const parlays = await prisma.parlay.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { legs: true },
  });

  return NextResponse.json({
    data: parlays.map((p) => ({
      id: String(p.id),
      stake: String(p.stake),
      status: p.status,
      payout: String(p.payout),
      createdAt: p.createdAt.toISOString(),
      legs: p.legs.map((l) => ({
        id: String(l.id),
        matchId: String(l.matchId),
        outcome: l.outcome,
        oddsSnapshot: l.oddsSnapshot.toString(),
        result: l.result,
      })),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    const parlay = await placeParlay(prisma, {
      userId: user.id,
      stake: BigInt(parsed.data.stake),
      legs: parsed.data.legs.map((l) => ({
        matchId: BigInt(l.matchId),
        outcome: l.outcome,
      })),
    });

    return NextResponse.json(
      {
        data: {
          id: String(parlay.id),
          stake: String(parlay.stake),
          status: parlay.status,
          legs: parlay.legs.map((l) => ({
            id: String(l.id),
            matchId: String(l.matchId),
            outcome: l.outcome,
            oddsSnapshot: l.oddsSnapshot.toString(),
            result: l.result,
          })),
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
