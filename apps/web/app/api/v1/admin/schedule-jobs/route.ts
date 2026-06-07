import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/admin/schedule-jobs — list all schedule-job registry rows.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const rows = await prisma.scheduleJob.findMany({ orderBy: { key: 'asc' } });
  return NextResponse.json({
    data: rows.map((r) => ({
      key: r.key, label: r.label, enabled: r.enabled, config: r.config,
      lastRunAt: r.lastRunAt, lastRunStatus: r.lastRunStatus, lastRunNote: r.lastRunNote, updatedAt: r.updatedAt,
    })),
  });
}
