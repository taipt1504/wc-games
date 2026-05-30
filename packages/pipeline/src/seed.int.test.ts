import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { seedTournament } from './seed';

const prisma = new PrismaClient();

async function clean() {
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.matchOdds.deleteMany();
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.group.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('seedTournament (integration · Postgres)', () => {
  it('loads 48 teams + 72 matches + 72 odds with aligned ids', async () => {
    const r = await seedTournament(prisma);
    expect(r.teams).toBe(48);
    expect(r.matches).toBe(72);
    expect(await prisma.team.count()).toBe(48);
    expect(await prisma.match.count()).toBe(72);
    expect(await prisma.matchOdds.count()).toBe(72);
    const fra = await prisma.team.findUnique({ where: { id: 16n } });
    expect(fra?.name).toBe('France'); // id aligns with @wc/fixtures
  });

  it('a known scheduled match (id 27) is future-dated + bettable with odds', async () => {
    const m = await prisma.match.findUnique({ where: { id: 27n }, include: { odds: true } });
    expect(m?.status).toBe('SCHEDULED');
    expect(m!.kickoffAt.getTime()).toBeGreaterThan(Date.now());
    expect(m?.odds).toBeTruthy();
    expect(Number(m!.odds!.mHome)).toBeGreaterThan(0);
  });

  it('is idempotent — re-seed keeps the same counts', async () => {
    await seedTournament(prisma);
    expect(await prisma.match.count()).toBe(72);
    expect(await prisma.team.count()).toBe(48);
    expect(await prisma.matchOdds.count()).toBe(72);
  });
});
