import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { createGatewayFromEnv } from '@wc/ai';
import { crawlAndStoreSquads } from '@wc/pipeline';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/teams/[id]/recrawl — AI re-crawl this team's squad (admin only). ~11s sync.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;

  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) return NextResponse.json({ error: { code: 'NO_GATEWAY' } }, { status: 503 });

  const team = await prisma.team.findUnique({ where: { id: BigInt(id) }, select: { id: true, name: true } });
  if (!team) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  const [result] = await crawlAndStoreSquads(prisma, gw, [{ id: team.id, name: team.name }]);
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'RECRAWL_SQUAD', target: `team:${id}`, metadata: { count: result.count, status: result.status } },
  });
  if (result.status === 'error') return NextResponse.json({ error: { code: 'CRAWL_FAILED' } }, { status: 502 });
  return NextResponse.json({ data: { count: result.count, status: result.status } });
}
