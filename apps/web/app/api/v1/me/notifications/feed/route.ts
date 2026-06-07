import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/me/notifications/feed — recent in-app notifications + unread count.
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: user.id, channel: 'IN_APP' },
      orderBy: { id: 'desc' }, take: 30,
      select: { id: true, type: true, payload: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId: user.id, channel: 'IN_APP', readAt: null } }),
  ]);
  return NextResponse.json({
    data: {
      items: rows.map((r) => ({ id: Number(r.id), type: r.type, payload: r.payload, readAt: r.readAt, createdAt: r.createdAt })),
      unread,
    },
  });
}
