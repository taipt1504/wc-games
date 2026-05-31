/**
 * Duel service — 1v1 head-to-head challenges (SOCIAL-04).
 * DuelStatus enum values: PENDING | ACTIVE | DONE
 *   PENDING  → challenge issued, awaiting response
 *   ACTIVE   → opponent accepted, duel live
 *   DONE     → opponent declined, or duel resolved (check winnerId)
 */
import type { PrismaClient, Duel } from '@wc/db';

type Tx = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

/** Create a challenge. Rejects self-duels. */
export async function createDuel(
  prisma: PrismaClient,
  challengerId: bigint,
  opponentId: bigint,
  scope: string,
): Promise<Duel> {
  if (challengerId === opponentId) throw new Error('SELF_DUEL');
  return prisma.duel.create({
    data: { challengerId, opponentId, scope, status: 'PENDING' },
  });
}

/** Opponent accepts (→ ACTIVE) or declines (→ DONE, no winner). */
export async function respondDuel(
  prisma: PrismaClient,
  duelId: bigint,
  opponentId: bigint,
  accept: boolean,
): Promise<Duel> {
  const duel = await prisma.duel.findUniqueOrThrow({ where: { id: duelId } });
  if (duel.opponentId !== opponentId) throw new Error('NOT_OPPONENT');
  if (duel.status !== 'PENDING') throw new Error('ALREADY_DECIDED');
  return prisma.duel.update({
    where: { id: duelId },
    data: { status: accept ? 'ACTIVE' : 'DONE' },
  });
}

export interface ResolveResult {
  winnerId: bigint | null;
  challengerNet: bigint;
  opponentNet: bigint;
}

/** Resolve an ACTIVE duel: winner = higher GLOBAL net profit (totalReturned - totalStaked). */
export async function resolveDuel(
  prisma: PrismaClient,
  duelId: bigint,
): Promise<ResolveResult> {
  const duel = await prisma.duel.findUniqueOrThrow({ where: { id: duelId } });
  if (duel.status !== 'ACTIVE') throw new Error('NOT_ACTIVE');

  const [cStats, oStats] = await Promise.all([
    prisma.predictionUserStats.findUnique({ where: { userId: duel.challengerId } }),
    prisma.predictionUserStats.findUnique({ where: { userId: duel.opponentId } }),
  ]);

  const challengerNet = (cStats?.totalReturned ?? 0n) - (cStats?.totalStaked ?? 0n);
  const opponentNet = (oStats?.totalReturned ?? 0n) - (oStats?.totalStaked ?? 0n);

  const winnerId =
    challengerNet > opponentNet
      ? duel.challengerId
      : opponentNet > challengerNet
        ? duel.opponentId
        : null;

  await prisma.duel.update({
    where: { id: duelId },
    data: { status: 'DONE', winnerId },
  });

  return { winnerId, challengerNet, opponentNet };
}

export interface DuelWithDisplay {
  id: bigint;
  challengerId: bigint;
  opponentId: bigint;
  scope: string;
  status: string;
  winnerId: bigint | null;
  createdAt: Date;
  challengerName: string;
  opponentName: string;
}

/** List all duels for a user (as challenger or opponent), newest first, with display names. */
export async function listDuels(
  prisma: PrismaClient,
  userId: bigint,
): Promise<DuelWithDisplay[]> {
  const duels = await prisma.duel.findMany({
    where: { OR: [{ challengerId: userId }, { opponentId: userId }] },
    orderBy: { createdAt: 'desc' },
  });

  if (duels.length === 0) return [];

  const userIds = [...new Set(duels.flatMap((d) => [d.challengerId, d.opponentId]))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, username: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.username ?? u.email]));

  return duels.map((d) => ({
    ...d,
    challengerName: nameMap.get(d.challengerId) ?? String(d.challengerId),
    opponentName: nameMap.get(d.opponentId) ?? String(d.opponentId),
  }));
}
