/**
 * Activity feed — social graph (lobby co-members), post-lock only (SOCIAL-05).
 * Returns co-members' predictions with status IN (LOCKED, WON, LOST), newest first.
 * OPEN predictions are intentionally excluded for privacy.
 */
import type { PrismaClient } from '@wc/db';

export interface FeedItem {
  who: string;
  action: 'bet' | 'won' | 'lost';
  matchId: string; // stringified BigInt — safe for JSON.stringify
  detail: string;
  when: string; // ISO timestamp
}

export async function activityFeed(
  prisma: PrismaClient,
  userId: bigint,
  limit = 20,
): Promise<FeedItem[]> {
  // 1. Find the user's lobby memberships → distinct lobbyIds
  const memberships = await prisma.lobbyMembership.findMany({
    where: { userId },
    select: { lobbyId: true },
  });
  if (memberships.length === 0) return [];

  const lobbyIds = memberships.map((m) => m.lobbyId);

  // 2. Find all co-members (other users in those lobbies)
  const coMemberRows = await prisma.lobbyMembership.findMany({
    where: { lobbyId: { in: lobbyIds }, userId: { not: userId } },
    select: { userId: true },
  });
  if (coMemberRows.length === 0) return [];

  const coMemberIds = [...new Set(coMemberRows.map((r) => r.userId))];

  // 3. Fetch their LOCKED/WON/LOST predictions, newest first by createdAt
  const predictions = await prisma.prediction.findMany({
    where: {
      userId: { in: coMemberIds },
      status: { in: ['LOCKED', 'WON', 'LOST'] },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      userId: true,
      matchId: true,
      status: true,
      payout: true,
      settledAt: true,
      createdAt: true,
    },
  });
  if (predictions.length === 0) return [];

  // 4. Resolve display names via a single users query
  const uniqueUserIds = [...new Set(predictions.map((p) => p.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: uniqueUserIds } },
    select: { id: true, email: true, username: true },
  });
  const nameOf = new Map(users.map((u) => [u.id, u.username ?? u.email]));

  // 5. Map to feed items
  return predictions.map((p): FeedItem => {
    const status = p.status as 'LOCKED' | 'WON' | 'LOST';
    const action: FeedItem['action'] =
      status === 'WON' ? 'won' : status === 'LOST' ? 'lost' : 'bet';

    let detail: string;
    if (status === 'WON') {
      detail = `WON +${p.payout}`;
    } else if (status === 'LOST') {
      detail = 'LOST';
    } else {
      detail = 'placed a pick';
    }

    return {
      who: nameOf.get(p.userId) ?? String(p.userId),
      action,
      matchId: String(p.matchId),
      detail,
      when: (p.settledAt ?? p.createdAt).toISOString(),
    };
  });
}
