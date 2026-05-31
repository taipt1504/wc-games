import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  createGatewayFromEnv,
  generateMatchPreview,
  deterministicPreview,
  AI_DISCLAIMER,
} from '@wc/ai';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  const { matchId } = await params;
  const id = BigInt(matchId);

  // Load match
  const match = await prisma.match.findUnique({ where: { id } });
  if (!match) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Load home + away teams
  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: match.homeTeamId } }),
    prisma.team.findUnique({ where: { id: match.awayTeamId } }),
  ]);
  if (!homeTeam || !awayTeam) {
    return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  }

  // Cache: return existing preview if present
  const cached = await prisma.aiPreview.findUnique({ where: { matchId: id } });
  if (cached) {
    return NextResponse.json({
      data: {
        content: cached.content,
        provider: cached.provider ?? 'rule-based',
        disclaimer: AI_DISCLAIMER,
      },
    });
  }

  // Generate preview
  const home = { name: homeTeam.name, rank: homeTeam.fifaRank ?? 999 };
  const away = { name: awayTeam.name, rank: awayTeam.fifaRank ?? 999 };

  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  const t0 = Date.now();
  let preview;
  if (gw) {
    preview = await generateMatchPreview(gw, { home, away }).catch(
      () => deterministicPreview({ home, away }),
    );
  } else {
    preview = deterministicPreview({ home, away });
  }
  const latencyMs = Date.now() - t0;

  // Persist (fire-and-forget; never breaks the response)
  void (async () => {
    try {
      await prisma.aiPreview.upsert({
        where: { matchId: id },
        create: { matchId: id, content: preview.content, provider: preview.provider },
        update: { content: preview.content, provider: preview.provider },
      });
      await prisma.aiJob.create({
        data: {
          type: 'preview',
          providerUsed: preview.provider ?? 'rule-based',
          status: 'ok',
          latencyMs,
        },
      });
    } catch {
      // persistence failure must not break the API response
    }
  })();

  return NextResponse.json({
    data: {
      content: preview.content,
      provider: preview.provider ?? 'rule-based',
      disclaimer: AI_DISCLAIMER,
    },
  });
}
