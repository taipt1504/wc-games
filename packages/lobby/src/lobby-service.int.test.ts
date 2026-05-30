import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { createLobby, joinLobby, requestBorrow, decideBorrow, getLobbyStanding } from './lobby-service';

const prisma = new PrismaClient();

async function clean() {
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

describe('lobby-service (integration · Postgres)', () => {
  let lobbyId: bigint;
  let ownerId: bigint;
  let memberId: bigint;

  it('createLobby seeds owner membership + lobby wallet + LOBBY_DEFAULT ledger', async () => {
    const owner = await prisma.user.create({ data: { email: 'owner@lobby.io', passwordHash: 'x' } });
    ownerId = owner.id;
    const lobby = await createLobby(prisma, ownerId, { name: 'The Lads', scope: 'GROUP', defaultPoints: 1000n, inviteToken: 'LADS26' });
    lobbyId = lobby.id;

    const w = await prisma.wallet.findFirstOrThrow({ where: { userId: ownerId, contextType: 'LOBBY', contextId: lobbyId } });
    expect(w.balance).toBe(1000n);
    const standing = await getLobbyStanding(prisma, lobbyId, ownerId);
    expect(standing.score).toBe(1000); // winnings 0 + default 1000 − borrowed 0
  });

  it('joinLobby gives a member their own lobby wallet at default points', async () => {
    const member = await prisma.user.create({ data: { email: 'member@lobby.io', passwordHash: 'x' } });
    memberId = member.id;
    await joinLobby(prisma, lobbyId, memberId);
    const standing = await getLobbyStanding(prisma, lobbyId, memberId);
    expect(standing.defaultPoints).toBe(1000n);
    expect(standing.score).toBe(1000);
    await expect(joinLobby(prisma, lobbyId, memberId)).rejects.toThrow('ALREADY_MEMBER');
  });

  it('approve borrow: credits lobby wallet, bumps borrowed, score = default − borrowed', async () => {
    const req = await requestBorrow(prisma, lobbyId, memberId, 200n);
    expect(req.status).toBe('PENDING');
    const decision = await decideBorrow(prisma, req.id, true, ownerId);
    expect(decision.status).toBe('APPROVED');

    const w = await prisma.wallet.findFirstOrThrow({ where: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId } });
    expect(w.balance).toBe(1200n); // 1000 + 200 borrowed
    const standing = await getLobbyStanding(prisma, lobbyId, memberId);
    expect(standing.borrowed).toBe(200n);
    expect(standing.score).toBe(800); // 0 + 1000 − 200 (borrowing is debt, not score)
  });

  it('winnings from settled lobby bets raise the score (PRD formula)', async () => {
    // simulate a won lobby bet: STAKE -100 then SETTLE +180 in this lobby context
    await prisma.pointLedger.create({ data: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId, type: 'STAKE', amount: -100n, balanceAfter: 1100n, refType: 'PREDICTION', refId: 1n } });
    await prisma.pointLedger.create({ data: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId, type: 'SETTLE', amount: 180n, balanceAfter: 1280n, refType: 'PREDICTION', refId: 1n } });
    const standing = await getLobbyStanding(prisma, lobbyId, memberId);
    expect(standing.winnings).toBe(80n); // -100 + 180
    expect(standing.score).toBe(880); // 80 + 1000 − 200
  });

  it('deny borrow: status DENIED, borrowed unchanged', async () => {
    const req = await requestBorrow(prisma, lobbyId, memberId, 300n);
    const decision = await decideBorrow(prisma, req.id, false, ownerId);
    expect(decision.status).toBe('DENIED');
    const standing = await getLobbyStanding(prisma, lobbyId, memberId);
    expect(standing.borrowed).toBe(200n); // still 200
  });
});
