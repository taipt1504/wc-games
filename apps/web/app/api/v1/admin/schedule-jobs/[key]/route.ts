import { NextResponse } from 'next/server';
import { z } from 'zod';
import { mergeJobConfig, JOB_KEYS, type JobKey } from '@wc/pipeline';
import type { Prisma } from '@wc/db';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const Schema = z.object({ enabled: z.boolean().optional(), config: z.record(z.unknown()).optional() });

// PATCH /api/v1/admin/schedule-jobs/[key] — update enabled flag and/or clamped config.
export async function PATCH(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });
  const { key } = await params;
  if (!JOB_KEYS.includes(key as JobKey)) return NextResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });

  const data: { enabled?: boolean; config?: Prisma.InputJsonValue; updatedBy: bigint } = { updatedBy: admin.id };
  if (parsed.data.enabled !== undefined) data.enabled = parsed.data.enabled;
  if (parsed.data.config !== undefined) {
    try { data.config = mergeJobConfig(key as JobKey, parsed.data.config) as unknown as Prisma.InputJsonValue; }
    catch (e) { return NextResponse.json({ error: { code: 'BAD_CONFIG', message: (e as Error).message } }, { status: 422 }); }
  }

  const row = await prisma.scheduleJob.update({ where: { key }, data });
  await prisma.auditLog.create({
    data: { actorType: 'ADMIN', actorId: admin.id, action: 'EDIT_SCHEDULE_JOB', target: `job:${key}`, metadata: { enabled: row.enabled, config: row.config as object } },
  });
  return NextResponse.json({ data: { key: row.key, enabled: row.enabled, config: row.config } });
}
