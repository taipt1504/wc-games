import { NextResponse } from 'next/server';
import { z } from 'zod';
import { placeSpecialBet } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const Schema = z.object({
  marketKey: z.string().min(1),
  pick: z.enum(['YES', 'NO']),
  stake: z.coerce.number().int().positive(),
  lobbyId: z.coerce.number().int().positive().optional(),
});

// POST /api/v1/special-predictions — place a special-market bet (global or lobby context).
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  const { marketKey, pick, stake, lobbyId } = parsed.data;

  if (lobbyId != null) {
    const membership = await prisma.lobbyMembership.findUnique({ where: { lobbyId_userId: { lobbyId: BigInt(lobbyId), userId: user.id } } });
    if (!membership) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  }
  try {
    const pred = await placeSpecialBet(prisma, {
      userId: user.id, marketKey, pick, stake: BigInt(stake),
      contextType: lobbyId != null ? 'LOBBY' : 'GLOBAL', contextId: lobbyId != null ? BigInt(lobbyId) : null,
    });
    return NextResponse.json({ data: { id: Number(pred.id), pick: pred.pick, stake: Number(pred.stake), oddsSnapshot: Number(pred.oddsSnapshot) } }, { status: 201 });
  } catch (e) {
    const code = (e as Error).message;
    const known = ['MARKET_NOT_FOUND', 'MARKET_CLOSED', 'ODDS_UNAVAILABLE', 'ALREADY_BET', 'INSUFFICIENT_BALANCE', 'INVALID_STAKE'];
    return NextResponse.json({ error: { code: known.includes(code) ? code : 'PLACE_FAILED' } }, { status: known.includes(code) ? 422 : 500 });
  }
}
