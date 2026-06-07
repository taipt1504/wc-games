import { NextResponse } from 'next/server';
import { createGatewayFromEnv } from '@wc/ai';
import { refreshMatchLineups } from '@wc/pipeline';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/matches/[id]/sync-lineup — AI re-crawl the projected XI for both teams (~20s).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { id } = await params;
  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  if (!gw) return NextResponse.json({ error: { code: 'NO_GATEWAY' } }, { status: 503 });

  const results = await refreshMatchLineups(prisma, gw, BigInt(id));
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'SYNC_LINEUP', target: `match:${id}`, metadata: { teams: results } },
  });
  if (results.length === 0) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  if (results.every((r) => r.status === 'error')) return NextResponse.json({ error: { code: 'CRAWL_FAILED' } }, { status: 502 });
  return NextResponse.json({ data: results });
}
