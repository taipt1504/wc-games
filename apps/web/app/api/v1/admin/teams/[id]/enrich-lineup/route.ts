import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { createGatewayFromEnv } from '@wc/ai';
import { enrichAndStoreLineup } from '@wc/pipeline';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/teams/[id]/enrich-lineup — LLM assigns roles + best XI to this team's FD roster.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) return NextResponse.json({ error: { code: 'LLM_NOT_CONFIGURED' } }, { status: 503 });

  let result;
  try {
    result = await enrichAndStoreLineup(prisma, gw, BigInt(id));
  } catch (e) {
    const code = (e as Error).message === 'TEAM_NOT_FOUND' ? 'NOT_FOUND' : 'ENRICH_FAILED';
    return NextResponse.json({ error: { code } }, { status: code === 'NOT_FOUND' ? 404 : 502 });
  }
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'ENRICH_LINEUP', target: `team:${id}`, metadata: { matched: result.matched, starters: result.starters, status: result.status } },
  });
  if (result.status === 'error') return NextResponse.json({ error: { code: 'ENRICH_FAILED' } }, { status: 502 });
  return NextResponse.json({ data: result });
}
