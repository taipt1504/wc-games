import { NextResponse } from 'next/server';
import { JOB_KEYS, type JobKey } from '@wc/pipeline';
import { publishEvent, channels } from '@wc/realtime';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/admin/schedule-jobs/[key]/trigger — publish a manual-run signal to the worker.
export async function POST(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { key } = await params;
  if (!JOB_KEYS.includes(key as JobKey)) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });

  await publishEvent(channels.control, { type: 'job.trigger', key });
  await prisma.auditLog.create({ data: { actorType: 'ADMIN', actorId: admin.id, action: 'TRIGGER_SCHEDULE_JOB', target: `job:${key}` } });
  return NextResponse.json({ data: { triggered: key } });
}
