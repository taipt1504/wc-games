/**
 * Integration tests for activityFeed (SOCIAL-05).
 * Requires Postgres at localhost:5433/wc_test (see .env / dotenv-cli setup).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { activityFeed } from './feed';

const prisma = new PrismaClient();

let userA: bigint;
let userB: bigint;
let userC: bigint;
let lobbyId: bigint;
let matchId: bigint;

async function clean() {
  // Delete in FK-safe order
  if (userA || userB || userC) {
    const ids = [userA, userB, userC].filter(Boolean);
    await prisma.prediction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.lobbyMembership.deleteMany({ where: { userId: { in: ids } } });
  }
  if (lobbyId) {
    await prisma.lobby.deleteMany({ where: { id: lobbyId } });
  }
  if (matchId) {
    await prisma.matchOdds.deleteMany({ where: { matchId } });
    await prisma.match.deleteMany({ where: { id: matchId } });
  }
  if (userA || userB || userC) {
    const ids = [userA, userB, userC].filter(Boolean);
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.pointLedger.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: {
      email: { in: ['feed-a@test.io', 'feed-b@test.io', 'feed-c@test.io'] },
    } });
  }
}

beforeAll(async () => {
  // Pre-clean any stale rows
  const existing = await prisma.user.findMany({
    where: { email: { in: ['feed-a@test.io', 'feed-b@test.io', 'feed-c@test.io'] } },
    select: { id: true },
  });
  if (existing.length > 0) {
    const ids = existing.map((u) => u.id);
    await prisma.prediction.deleteMany({ where: { userId: { in: ids } } });
    await prisma.lobbyMembership.deleteMany({ where: { userId: { in: ids } } });
    // Clean up lobbies owned by these users
    const ownedLobbies = await prisma.lobby.findMany({
      where: { ownerId: { in: ids } },
      select: { id: true },
    });
    if (ownedLobbies.length > 0) {
      await prisma.lobby.deleteMany({ where: { id: { in: ownedLobbies.map((l) => l.id) } } });
    }
    await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  // Create users
  const a = await prisma.user.create({ data: { email: 'feed-a@test.io', passwordHash: 'x', username: 'UserA' } });
  const b = await prisma.user.create({ data: { email: 'feed-b@test.io', passwordHash: 'x', username: 'UserB' } });
  const c = await prisma.user.create({ data: { email: 'feed-c@test.io', passwordHash: 'x', username: 'UserC' } });
  userA = a.id;
  userB = b.id;
  userC = c.id;

  // Create a match (required FK for predictions)
  const match = await prisma.match.create({
    data: {
      round: 'GROUP',
      homeTeamId: 201n,
      awayTeamId: 202n,
      kickoffAt: new Date('2026-06-15T15:00:00Z'),
      status: 'FINISHED',
    },
  });
  matchId = match.id;

  // Create a lobby — A & B are members (C is NOT)
  const lobby = await prisma.lobby.create({
    data: {
      ownerId: userA,
      name: 'Feed Test Lobby',
      inviteToken: `feed-tok-${Date.now()}`,
      scope: 'ALL',
      defaultPoints: 1000n,
    },
  });
  lobbyId = lobby.id;

  await prisma.lobbyMembership.createMany({
    data: [
      { lobbyId, userId: userA, role: 'OWNER', defaultPoints: 1000n },
      { lobbyId, userId: userB, role: 'MEMBER', defaultPoints: 1000n },
    ],
  });

  // B: WON prediction
  await prisma.prediction.create({
    data: {
      userId: userB,
      contextType: 'GLOBAL',
      contextId: null,
      matchId,
      market: '1X2',
      outcome: 'HOME',
      stake: 100n,
      oddsSnapshot: 1.8,
      status: 'WON',
      payout: 180n,
      settledAt: new Date('2026-06-15T17:00:00Z'),
    },
  });

  // B: LOCKED prediction (different context to avoid unique constraint clash)
  await prisma.prediction.create({
    data: {
      userId: userB,
      contextType: 'LOBBY',
      contextId: lobbyId,
      matchId,
      market: '1X2',
      outcome: 'HOME',
      stake: 50n,
      oddsSnapshot: 1.8,
      status: 'LOCKED',
      payout: 0n,
    },
  });

  // B: OPEN prediction (should be excluded)
  // Need a different match to avoid unique constraint (userId+contextType+contextId+matchId+market)
  const match2 = await prisma.match.create({
    data: {
      round: 'GROUP',
      homeTeamId: 203n,
      awayTeamId: 204n,
      kickoffAt: new Date('2026-06-16T15:00:00Z'),
      status: 'SCHEDULED',
    },
  });
  await prisma.prediction.create({
    data: {
      userId: userB,
      contextType: 'GLOBAL',
      contextId: null,
      matchId: match2.id,
      market: '1X2',
      outcome: 'DRAW',
      stake: 50n,
      oddsSnapshot: 3.0,
      status: 'OPEN',
      payout: 0n,
    },
  });
  // track match2 for cleanup
  // (We'll clean via user predictions delete, so match2 FK must be handled)
  // Stash match2.id in matchId variable — but we need both. Use separate cleanup logic.
  // We'll delete all predictions by userB/C in clean() which covers both matches.
  // Store match2 id to cleanup later via a module-level var.
  match2IdForCleanup = match2.id;

  // C: WON prediction — C is NOT in the lobby, so should be excluded
  await prisma.prediction.create({
    data: {
      userId: userC,
      contextType: 'GLOBAL',
      contextId: null,
      matchId,
      market: '1X2',
      outcome: 'AWAY',
      stake: 100n,
      oddsSnapshot: 4.0,
      status: 'WON',
      payout: 400n,
      settledAt: new Date('2026-06-15T17:05:00Z'),
    },
  });
});

let match2IdForCleanup: bigint;

afterAll(async () => {
  // Clean in FK-safe order
  const ids = [userA, userB, userC].filter(Boolean);
  await prisma.prediction.deleteMany({ where: { userId: { in: ids } } });
  await prisma.lobbyMembership.deleteMany({ where: { userId: { in: ids } } });
  if (lobbyId) {
    await prisma.lobby.deleteMany({ where: { id: lobbyId } });
  }
  if (matchId) {
    await prisma.matchOdds.deleteMany({ where: { matchId } });
    await prisma.match.deleteMany({ where: { id: matchId } });
  }
  if (match2IdForCleanup) {
    await prisma.matchOdds.deleteMany({ where: { matchId: match2IdForCleanup } });
    await prisma.match.deleteMany({ where: { id: match2IdForCleanup } });
  }
  await prisma.wallet.deleteMany({ where: { userId: { in: ids } } });
  await prisma.pointLedger.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: {
    email: { in: ['feed-a@test.io', 'feed-b@test.io', 'feed-c@test.io'] },
  } });
  await prisma.$disconnect();
});

describe('activityFeed (integration · Postgres)', () => {
  it('includes B\'s WON and LOCKED predictions', async () => {
    const feed = await activityFeed(prisma, userA);
    const actions = feed.map((f) => f.action);
    expect(actions).toContain('won');
    expect(actions).toContain('bet');
  });

  it('excludes B\'s OPEN prediction', async () => {
    const feed = await activityFeed(prisma, userA);
    // OPEN status maps to no "bet" from OPEN — but LOCKED also maps to "bet".
    // Verify: the count of "bet" items should be 1 (only LOCKED), not 2
    const betItems = feed.filter((f) => f.action === 'bet');
    expect(betItems).toHaveLength(1);
  });

  it('excludes C entirely (not a co-member)', async () => {
    const feed = await activityFeed(prisma, userA);
    const names = feed.map((f) => f.who);
    expect(names).not.toContain('UserC');
  });

  it('B\'s WON item has correct who, action, detail', async () => {
    const feed = await activityFeed(prisma, userA);
    const wonItem = feed.find((f) => f.action === 'won');
    expect(wonItem).toBeDefined();
    expect(wonItem!.who).toBe('UserB');
    expect(wonItem!.detail).toMatch(/WON \+180/);
    expect(wonItem!.matchId).toBe(String(matchId));
  });

  it('feed items are JSON-serializable (no raw BigInt)', async () => {
    const feed = await activityFeed(prisma, userA);
    expect(() => JSON.stringify(feed)).not.toThrow();
  });

  it('user in no lobbies returns empty array', async () => {
    const feed = await activityFeed(prisma, userC);
    expect(feed).toEqual([]);
  });
});
