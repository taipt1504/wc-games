import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET — AI pipeline metrics (last 50 AiJob rows + KPIs). ADMIN-07.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const jobs = await prisma.aiJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // KPIs
  const total = jobs.length;
  const last24h = jobs.filter((j) => j.createdAt >= since24h).length;

  // Counts by provider
  const byProvider: Record<string, number> = {};
  for (const j of jobs) {
    const p = j.providerUsed ?? 'unknown';
    byProvider[p] = (byProvider[p] ?? 0) + 1;
  }

  // Fallback = any provider that is not 'claude' and not 'rule-based'
  const primaryProviders = new Set(['claude', 'rule-based']);
  const fallbackCount = jobs.filter(
    (j) => j.providerUsed != null && !primaryProviders.has(j.providerUsed)
  ).length;

  const latencies = jobs.map((j) => j.latencyMs).filter((v): v is number => v != null);
  const avgLatencyMs = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;

  const totalCost = jobs.reduce((acc, j) => acc + (j.cost != null ? Number(j.cost) : 0), 0);

  return NextResponse.json({
    data: {
      jobs: jobs.map((j) => ({
        id: Number(j.id),
        type: j.type,
        providerUsed: j.providerUsed ?? 'unknown',
        status: j.status,
        tokens: j.tokens,
        cost: j.cost != null ? Number(j.cost) : null,
        latencyMs: j.latencyMs,
        error: j.error,
        createdAt: j.createdAt.toISOString(),
      })),
      kpis: {
        total,
        last24h,
        byProvider,
        fallbackCount,
        avgLatencyMs,
        totalCost: Math.round(totalCost * 100) / 100,
      },
    },
  });
}
