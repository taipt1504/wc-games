import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// POST /api/v1/me/notifications/read — mark all the user's unread in-app notifications read.
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  await prisma.notification.updateMany({
    where: { userId: user.id, channel: 'IN_APP', readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ data: { ok: true } });
}
