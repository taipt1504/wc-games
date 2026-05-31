import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { createDuel, respondDuel, resolveDuel } from './duel';

const prisma = new PrismaClient();

let challengerId: bigint;
let opponentId: bigint;
let thirdId: bigint;

async function clean() {
  await prisma.duel.deleteMany({ where: { OR: [{ challengerId }, { opponentId }, { challengerId: thirdId }] } });
  await prisma.predictionUserStats.deleteMany({ where: { userId: { in: [challengerId, opponentId, thirdId] } } });
  await prisma.user.deleteMany({ where: { email: { in: ['challenger@duel.test', 'opponent@duel.test', 'third@duel.test'] } } });
}

beforeAll(async () => {
  // Pre-clean any stale rows from prior runs (idempotent)
  const users = await prisma.user.findMany({
    where: { email: { in: ['challenger@duel.test', 'opponent@duel.test', 'third@duel.test'] } },
  });
  if (users.length) {
    const ids = users.map((u) => u.id);
    await prisma.duel.deleteMany({ where: { OR: [{ challengerId: { in: ids } }, { opponentId: { in: ids } }] } });
    await prisma.predictionUserStats.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }

  const c = await prisma.user.create({ data: { email: 'challenger@duel.test', passwordHash: 'x' } });
  const o = await prisma.user.create({ data: { email: 'opponent@duel.test', passwordHash: 'x' } });
  const t = await prisma.user.create({ data: { email: 'third@duel.test', passwordHash: 'x' } });
  challengerId = c.id;
  opponentId = o.id;
  thirdId = t.id;
});

afterAll(async () => {
  await clean();
  await prisma.$disconnect();
});

describe('duel service (integration · Postgres)', () => {
  it('createDuel creates a PENDING duel', async () => {
    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    expect(duel.status).toBe('PENDING');
    expect(duel.challengerId).toBe(challengerId);
    expect(duel.opponentId).toBe(opponentId);
    expect(duel.winnerId).toBeNull();
    // clean up
    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('createDuel throws SELF_DUEL when challenger === opponent', async () => {
    await expect(createDuel(prisma, challengerId, challengerId, 'GLOBAL')).rejects.toThrow('SELF_DUEL');
  });

  it('respondDuel by non-opponent throws NOT_OPPONENT', async () => {
    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    await expect(respondDuel(prisma, duel.id, thirdId, true)).rejects.toThrow('NOT_OPPONENT');
    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('opponent accepts → status becomes ACTIVE', async () => {
    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    const updated = await respondDuel(prisma, duel.id, opponentId, true);
    expect(updated.status).toBe('ACTIVE');
    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('opponent declines → status becomes DONE, no winner', async () => {
    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    const updated = await respondDuel(prisma, duel.id, opponentId, false);
    expect(updated.status).toBe('DONE');
    expect(updated.winnerId).toBeNull();
    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('respondDuel on non-PENDING duel throws ALREADY_DECIDED', async () => {
    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    await respondDuel(prisma, duel.id, opponentId, true); // accept → ACTIVE
    await expect(respondDuel(prisma, duel.id, opponentId, true)).rejects.toThrow('ALREADY_DECIDED');
    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('resolveDuel: challenger net 500 > opponent net 200 → challenger wins', async () => {
    // Seed stats: challenger returned=500, staked=0 → net 500
    //            opponent  returned=200, staked=0 → net 200
    await prisma.predictionUserStats.upsert({
      where: { userId: challengerId },
      create: { userId: challengerId, totalReturned: 500n, totalStaked: 0n },
      update: { totalReturned: 500n, totalStaked: 0n },
    });
    await prisma.predictionUserStats.upsert({
      where: { userId: opponentId },
      create: { userId: opponentId, totalReturned: 200n, totalStaked: 0n },
      update: { totalReturned: 200n, totalStaked: 0n },
    });

    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    await respondDuel(prisma, duel.id, opponentId, true); // → ACTIVE

    const result = await resolveDuel(prisma, duel.id);
    expect(result.winnerId).toBe(challengerId);
    expect(result.challengerNet).toBe(500n);
    expect(result.opponentNet).toBe(200n);

    // Verify DB state
    const updated = await prisma.duel.findUniqueOrThrow({ where: { id: duel.id } });
    expect(updated.status).toBe('DONE');
    expect(updated.winnerId).toBe(challengerId);

    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('resolveDuel: tied nets → winnerId null', async () => {
    // Equal nets
    await prisma.predictionUserStats.upsert({
      where: { userId: challengerId },
      create: { userId: challengerId, totalReturned: 300n, totalStaked: 0n },
      update: { totalReturned: 300n, totalStaked: 0n },
    });
    await prisma.predictionUserStats.upsert({
      where: { userId: opponentId },
      create: { userId: opponentId, totalReturned: 300n, totalStaked: 0n },
      update: { totalReturned: 300n, totalStaked: 0n },
    });

    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    await respondDuel(prisma, duel.id, opponentId, true); // → ACTIVE

    const result = await resolveDuel(prisma, duel.id);
    expect(result.winnerId).toBeNull();

    await prisma.duel.delete({ where: { id: duel.id } });
  });

  it('resolveDuel on non-ACTIVE duel throws NOT_ACTIVE', async () => {
    const duel = await createDuel(prisma, challengerId, opponentId, 'GLOBAL');
    // Still PENDING
    await expect(resolveDuel(prisma, duel.id)).rejects.toThrow('NOT_ACTIVE');
    await prisma.duel.delete({ where: { id: duel.id } });
  });
});
