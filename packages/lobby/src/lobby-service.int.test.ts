import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { createLobby, joinLobby, requestBorrow, decideBorrow, getLobbyStanding, transferHost, kickMember } from './lobby-service';

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

describe('transferHost + kickMember (integration · Postgres)', () => {
  let lobbyId: bigint;
  let ownerId: bigint;
  let member1Id: bigint;
  let member2Id: bigint;

  beforeAll(async () => {
    await clean();
    const owner = await prisma.user.create({ data: { email: 'th-owner@lobby.io', passwordHash: 'x' } });
    ownerId = owner.id;
    const lobby = await createLobby(prisma, ownerId, { name: 'Transfer Test', scope: 'GROUP', defaultPoints: 500n, inviteToken: 'TXFER1' });
    lobbyId = lobby.id;
    const m1 = await prisma.user.create({ data: { email: 'th-member1@lobby.io', passwordHash: 'x' } });
    member1Id = m1.id;
    const m2 = await prisma.user.create({ data: { email: 'th-member2@lobby.io', passwordHash: 'x' } });
    member2Id = m2.id;
    await joinLobby(prisma, lobbyId, member1Id);
    await joinLobby(prisma, lobbyId, member2Id);
  });

  afterAll(async () => { await clean(); await prisma.$disconnect(); });

  it('transferHost: ownerId changes and roles swap', async () => {
    const updated = await transferHost(prisma, lobbyId, ownerId, member1Id);
    expect(updated.ownerId).toBe(member1Id);

    const newOwnerMs = await prisma.lobbyMembership.findUniqueOrThrow({ where: { lobbyId_userId: { lobbyId, userId: member1Id } } });
    expect(newOwnerMs.role).toBe('OWNER');

    const oldOwnerMs = await prisma.lobbyMembership.findUniqueOrThrow({ where: { lobbyId_userId: { lobbyId, userId: ownerId } } });
    expect(oldOwnerMs.role).toBe('MEMBER');

    // transfer back so subsequent tests see member1Id as owner
    await transferHost(prisma, lobbyId, member1Id, ownerId);
  });

  it('transferHost: non-owner calling throws NOT_OWNER', async () => {
    await expect(transferHost(prisma, lobbyId, member1Id, member2Id)).rejects.toThrow('NOT_OWNER');
  });

  it('transferHost: non-member target throws NOT_A_MEMBER', async () => {
    const stranger = await prisma.user.create({ data: { email: 'stranger@lobby.io', passwordHash: 'x' } });
    await expect(transferHost(prisma, lobbyId, ownerId, stranger.id)).rejects.toThrow('NOT_A_MEMBER');
  });

  it('kickMember: removes the target membership', async () => {
    await kickMember(prisma, lobbyId, ownerId, member2Id);
    const ms = await prisma.lobbyMembership.findUnique({ where: { lobbyId_userId: { lobbyId, userId: member2Id } } });
    expect(ms).toBeNull();
  });

  it('kickMember: non-owner calling throws NOT_OWNER', async () => {
    await expect(kickMember(prisma, lobbyId, member1Id, ownerId)).rejects.toThrow('NOT_OWNER');
  });

  it('kickMember: kicking the owner themselves throws CANNOT_KICK_OWNER', async () => {
    await expect(kickMember(prisma, lobbyId, ownerId, ownerId)).rejects.toThrow('CANNOT_KICK_OWNER');
  });

  it('kickMember: kicking a non-member throws NOT_A_MEMBER', async () => {
    await expect(kickMember(prisma, lobbyId, ownerId, member2Id)).rejects.toThrow('NOT_A_MEMBER');
  });
});
