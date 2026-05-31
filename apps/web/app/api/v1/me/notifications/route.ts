import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getNotificationPrefs, updateNotificationPrefs, NOTIFICATION_TYPES } from '@wc/auth';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const data = await getNotificationPrefs(prisma, user.id);
  return NextResponse.json({ data });
}

const PatchSchema = z.object(
  Object.fromEntries(NOTIFICATION_TYPES.map((t) => [t, z.boolean().optional()])) as Record<
    (typeof NOTIFICATION_TYPES)[number],
    z.ZodOptional<z.ZodBoolean>
  >,
);

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'INVALID_BODY', details: parsed.error.flatten() } }, { status: 400 });
  }
  const data = await updateNotificationPrefs(prisma, user.id, parsed.data);
  return NextResponse.json({ data });
}
