import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeMicro, listMicro } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

const PostSchema = z.object({
  matchId: z.coerce.number().int().positive(),
  market: z.string().min(1),
  pick: z.string().min(1),
  stake: z.coerce.number().int().positive(),
});

const ERR_STATUS: Record<string, number> = {
  NOT_LIVE: 409,
  INVALID_MARKET: 422,
  INSUFFICIENT_BALANCE: 422,
};

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const url = new URL(req.url);
  const matchIdParam = url.searchParams.get('matchId');
  const matchId = matchIdParam ? BigInt(matchIdParam) : undefined;

  const micros = await listMicro(prisma, user.id, matchId);
  return NextResponse.json({
    data: micros.map((m) => ({
      id: String(m.id),
      matchId: String(m.matchId),
      market: m.market,
      pick: m.pick,
      stake: String(m.stake),
      oddsSnapshot: m.oddsSnapshot.toString(),
      status: m.status,
      payout: String(m.payout),
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  try {
    const micro = await placeMicro(prisma, {
      userId: user.id,
      matchId: BigInt(parsed.data.matchId),
      market: parsed.data.market,
      pick: parsed.data.pick,
      stake: BigInt(parsed.data.stake),
    });
    return NextResponse.json(
      {
        data: {
          id: String(micro.id),
          matchId: String(micro.matchId),
          market: micro.market,
          pick: micro.pick,
          stake: String(micro.stake),
          oddsSnapshot: micro.oddsSnapshot.toString(),
          status: micro.status,
          payout: String(micro.payout),
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
