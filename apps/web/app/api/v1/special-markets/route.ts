import { NextResponse } from 'next/server';
import { resolveSpecialOdds } from '@wc/prediction';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/special-markets[?lobbyId=] — markets with context-resolved odds + caller's bet.
export async function GET(req: Request) {
  const user = await getSessionUser();
  const url = new URL(req.url);
  const lobbyIdRaw = url.searchParams.get('lobbyId');
  const lobbyId = lobbyIdRaw ? BigInt(lobbyIdRaw) : undefined;
  const contextType = lobbyId != null ? 'LOBBY' : 'GLOBAL';
  const contextId = lobbyId ?? null;

  const markets = await prisma.specialMarket.findMany({ orderBy: { createdAt: 'asc' } });
  const data = await Promise.all(markets.map(async (m) => {
    const odds = await resolveSpecialOdds(prisma, m.id, lobbyId);
    const mine = user ? await prisma.specialPrediction.findFirst({ where: { userId: user.id, contextType, contextId, marketId: m.id }, orderBy: { createdAt: 'desc' } }) : null;
    return {
      key: m.key, title: m.title, titleVi: m.titleVi, subtitle: m.subtitle, subtitleVi: m.subtitleVi,
      status: m.status, resolvedOutcome: m.resolvedOutcome,
      oddsYes: odds ? odds.oddsYes : Number(m.oddsYes),
      oddsNo: odds ? odds.oddsNo : Number(m.oddsNo),
      oddsSource: odds?.source ?? 'GLOBAL',
      yourBet: mine ? { pick: mine.pick, stake: Number(mine.stake), oddsSnapshot: Number(mine.oddsSnapshot), status: mine.status, payout: Number(mine.payout) } : null,
    };
  }));
  return NextResponse.json({ data });
}
