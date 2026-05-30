import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { scanLobbyRisk } from './risk-engine';

const prisma = new PrismaClient();

async function clean() {
  // FK-safe full reset (shared test DB may carry data from other suites/e2e)
  await prisma.riskFlag.deleteMany();
  await prisma.borrowRequest.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.lobbyMembership.deleteMany();
  await prisma.lobby.deleteMany();
  await prisma.user.deleteMany();
}

beforeAll(async () => { await clean(); });
afterAll(async () => { await clean(); await prisma.$disconnect(); });

describe('risk-engine scanLobbyRisk (integration · Postgres)', () => {
  it('flags a small borrowing lobby as High risk; ignores a clean lobby', async () => {
    const u1 = await prisma.user.create({ data: { email: 'r1@risk.io', passwordHash: 'x' } });
    const u2 = await prisma.user.create({ data: { email: 'r2@risk.io', passwordHash: 'x' } });
    const u3 = await prisma.user.create({ data: { email: 'r3@risk.io', passwordHash: 'x' } });

    // suspicious: 2-member lobby, one member with 500 borrowed
    const bad = await prisma.lobby.create({ data: { ownerId: u1.id, name: 'private_room_x', scope: 'GROUP', defaultPoints: 1000n, inviteToken: 'BAD1' } });
    await prisma.lobbyMembership.create({ data: { lobbyId: bad.id, userId: u1.id, role: 'OWNER', defaultPoints: 1000n, borrowed: 0n } });
    await prisma.lobbyMembership.create({ data: { lobbyId: bad.id, userId: u2.id, role: 'MEMBER', defaultPoints: 1000n, borrowed: 500n } });

    // clean: 3-member lobby, no borrowing
    const good = await prisma.lobby.create({ data: { ownerId: u1.id, name: 'friendly league', scope: 'ALL', defaultPoints: 1000n, inviteToken: 'GOOD1' } });
    for (const u of [u1, u2, u3]) {
      await prisma.lobbyMembership.create({ data: { lobbyId: good.id, userId: u.id, role: u.id === u1.id ? 'OWNER' : 'MEMBER', defaultPoints: 1000n, borrowed: 0n } });
    }

    const r = await scanLobbyRisk(prisma);
    expect(r.scanned).toBe(2);
    expect(r.flagged).toBe(1);

    const badFlag = await prisma.riskFlag.findFirst({ where: { targetType: 'LOBBY', targetId: bad.id } });
    expect(badFlag).toBeTruthy();
    expect(badFlag!.severity).toBe('High'); // 50 + 30 + 20 = 100
    expect(badFlag!.rule).toMatch(/collusion/i);

    const goodFlag = await prisma.riskFlag.findFirst({ where: { targetType: 'LOBBY', targetId: good.id } });
    expect(goodFlag).toBeNull();
  });

  it('is idempotent — re-scan does not duplicate the open flag', async () => {
    const r = await scanLobbyRisk(prisma);
    expect(r.flagged).toBe(0); // existing OPEN flag, no new one
    const count = await prisma.riskFlag.count({ where: { targetType: 'LOBBY' } });
    expect(count).toBe(1);
  });
});
