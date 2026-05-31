import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { getBracket, saveBracket } from './bracket';

const prisma = new PrismaClient();

async function clean(userId?: bigint) {
  if (userId) {
    await prisma.bracket.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  } else {
    await prisma.bracket.deleteMany();
    await prisma.user.deleteMany({ where: { email: 'bracket@test.io' } });
  }
}

let userId: bigint;

beforeAll(async () => {
  await clean();
  const user = await prisma.user.create({ data: { email: 'bracket@test.io', passwordHash: 'x' } });
  userId = user.id;
});

afterAll(async () => {
  await clean(userId);
  await prisma.$disconnect();
});

describe('bracket (integration · Postgres)', () => {
  it('getBracket for new user returns empty picks', async () => {
    const result = await getBracket(prisma, userId);
    expect(result.picks).toEqual({});
    expect(result.lockedAt).toBeNull();
    expect(result.score).toBe(0);
  });

  it('saveBracket({ CHAMPION: 7 }) persists', async () => {
    const result = await saveBracket(prisma, userId, { CHAMPION: 7 });
    expect(result.picks).toMatchObject({ CHAMPION: 7 });
    expect(result.lockedAt).toBeNull();
  });

  it('getBracket reflects the saved pick', async () => {
    const result = await getBracket(prisma, userId);
    expect(result.picks).toMatchObject({ CHAMPION: 7 });
  });

  it('saving again updates picks (partial → full)', async () => {
    const result = await saveBracket(prisma, userId, { CHAMPION: 7, FINALISTS: [7, 12], SEMIS: [7, 12, 5, 3] });
    expect(result.picks).toMatchObject({ CHAMPION: 7, FINALISTS: [7, 12], SEMIS: [7, 12, 5, 3] });
  });

  it('a bracket with lockedAt set throws BRACKET_LOCKED', async () => {
    // Set lockedAt directly via prisma
    await prisma.bracket.update({ where: { userId }, data: { lockedAt: new Date() } });
    await expect(saveBracket(prisma, userId, { CHAMPION: 1 })).rejects.toThrow('BRACKET_LOCKED');
    // Cleanup — reset lockedAt for subsequent tests
    await prisma.bracket.update({ where: { userId }, data: { lockedAt: null } });
  });

  it('malformed picks: FINALISTS array of 5 → INVALID_PICKS', async () => {
    await expect(saveBracket(prisma, userId, { FINALISTS: [1, 2, 3, 4, 5] })).rejects.toThrow('INVALID_PICKS');
  });

  it('malformed picks: SEMIS array of 5 → INVALID_PICKS', async () => {
    await expect(saveBracket(prisma, userId, { SEMIS: [1, 2, 3, 4, 5] })).rejects.toThrow('INVALID_PICKS');
  });

  it('malformed picks: non-object → INVALID_PICKS', async () => {
    await expect(saveBracket(prisma, userId, 'bad')).rejects.toThrow('INVALID_PICKS');
  });

  it('malformed picks: CHAMPION as string → INVALID_PICKS', async () => {
    await expect(saveBracket(prisma, userId, { CHAMPION: 'brazil' })).rejects.toThrow('INVALID_PICKS');
  });

  it('partial picks allowed: CHAMPION only', async () => {
    const result = await saveBracket(prisma, userId, { CHAMPION: 42 });
    expect(result.picks).toMatchObject({ CHAMPION: 42 });
  });
});
