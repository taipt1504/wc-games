import type { PrismaClient, Prisma } from '@wc/db';
import { publishEvent, channels } from '@wc/realtime';

/**
 * Create an in-app notification + push it live to the user's realtime channel.
 * Best-effort realtime (publishEvent never throws); the row is persisted regardless.
 */
export async function notify(
  prisma: PrismaClient,
  userId: bigint,
  type: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const n = await prisma.notification.create({
    data: { userId, type, channel: 'IN_APP', payload: payload as Prisma.InputJsonValue, status: 'SENT' },
  });
  await publishEvent(channels.user(String(userId)), {
    type: 'notification',
    notification: { id: Number(n.id), type, payload, createdAt: n.createdAt, readAt: null },
  });
}
