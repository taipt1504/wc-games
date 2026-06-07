import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/metrics — real ops KPIs from existing tables (no proxies/fabrication).
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [betsToday, articlesPending, settled, totalUsers] = await Promise.all([
    prisma.prediction.count({ where: { createdAt: { gte: start } } }),
    prisma.newsArticle.count({ where: { status: 'PENDING' } }),
    prisma.prediction.count({ where: { status: { in: ['WON', 'LOST'] } } }),
    prisma.user.count(),
  ]);
  return NextResponse.json({ data: { betsToday, articlesPending, settled, totalUsers } });
}
