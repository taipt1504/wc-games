import { NextResponse } from 'next/server';
import { createGatewayFromEnv } from '@wc/ai';
import { proposeOdds } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/matches/[id]/odds/propose — AI-estimate a 1X2 line (draft only, not saved).
// Admin reviews + publishes via POST .../odds. Returns profit multipliers.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) return NextResponse.json({ error: { code: 'NO_GATEWAY' } }, { status: 503 });

  const match = await prisma.match.findUnique({ where: { id: BigInt(id) }, select: { homeTeamId: true, awayTeamId: true } });
  if (!match) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  const teams = await prisma.team.findMany({ where: { id: { in: [match.homeTeamId, match.awayTeamId] } }, select: { id: true, name: true } });
  const home = teams.find((t) => t.id === match.homeTeamId)?.name ?? 'Home';
  const away = teams.find((t) => t.id === match.awayTeamId)?.name ?? 'Away';

  try {
    const odds = await proposeOdds(gw, { home, away });
    return NextResponse.json({ data: odds });
  } catch {
    return NextResponse.json({ error: { code: 'PROPOSE_FAILED' } }, { status: 502 });
  }
}
