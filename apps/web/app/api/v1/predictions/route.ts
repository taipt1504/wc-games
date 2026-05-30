import { NextResponse } from 'next/server';
import { z } from 'zod';

// Đặt kèo 1X2 — schema theo Prediction & Scoring Service Design (UC-04).
const PlaceBetSchema = z.object({
  matchId: z.coerce.bigint(),
  context: z.object({
    type: z.enum(['GLOBAL', 'LOBBY']),
    id: z.coerce.bigint().optional(),
  }),
  outcome: z.enum(['HOME', 'DRAW', 'AWAY']), // map: HOME='1', DRAW='X', AWAY='2'
  stake: z.coerce.bigint().positive(),
  exactScore: z.object({ home: z.number().int().min(0), away: z.number().int().min(0) }).optional(),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PlaceBetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid body', details: parsed.error.issues } },
      { status: 422 },
    );
  }

  // TODO (P0) — implement theo docs/solution-design Prediction&Scoring SD, UC-04:
  //   1) lấy userId từ session (Auth)
  //   2) DB tx: SELECT match (kickoff,status) + match_odds; SELECT wallet FOR UPDATE
  //   3) check now < kickoff & stake <= balance & chưa có kèo (match,context)
  //   4) wallet.balance -= stake; INSERT point_ledger(STAKE); INSERT prediction(OPEN, oddsSnapshot)
  //   5) COMMIT; invalidate cache; trả 201 + potentialPayout
  return NextResponse.json(
    { error: { code: 'NOT_IMPLEMENTED', message: 'Stub — xem Prediction & Scoring Service Design (UC-04)' } },
    { status: 501 },
  );
}
