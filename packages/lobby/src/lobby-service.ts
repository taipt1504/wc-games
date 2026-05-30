/**
 * @wc/lobby — Private lobby + borrow service (PRD §03D / §04.6 / FR-LOBBY-01..06).
 * Each lobby is an isolated wallet context (contextType=LOBBY, contextId=lobbyId).
 * Standing score = winnings + default − borrowed (borrowing is debt, doesn't raise rank).
 */
import type { PrismaClient, LobbyScope } from '@wc/db';
import { lobbyScore } from '@wc/core';

export interface CreateLobbyInput {
  name: string;
  scope: LobbyScope;
  defaultPoints: bigint;
  inviteToken: string;
  passwordHash?: string;
}

/** Create a lobby; owner gets a membership + lobby wallet seeded with defaultPoints. */
export async function createLobby(prisma: PrismaClient, ownerId: bigint, input: CreateLobbyInput) {
  return prisma.$transaction(async (tx) => {
    const lobby = await tx.lobby.create({
      data: {
        ownerId, name: input.name, scope: input.scope, defaultPoints: input.defaultPoints,
        inviteToken: input.inviteToken, passwordHash: input.passwordHash, allowBorrow: true,
      },
    });
    await tx.lobbyMembership.create({ data: { lobbyId: lobby.id, userId: ownerId, role: 'OWNER', defaultPoints: input.defaultPoints, borrowed: 0n } });
    await tx.wallet.create({ data: { userId: ownerId, contextType: 'LOBBY', contextId: lobby.id, balance: input.defaultPoints } });
    await tx.pointLedger.create({ data: { userId: ownerId, contextType: 'LOBBY', contextId: lobby.id, type: 'LOBBY_DEFAULT', amount: input.defaultPoints, balanceAfter: input.defaultPoints, refType: 'LOBBY', refId: lobby.id } });
    return lobby;
  });
}

/** Join a lobby: create membership + lobby wallet seeded with the lobby's default points. */
export async function joinLobby(prisma: PrismaClient, lobbyId: bigint, userId: bigint) {
  return prisma.$transaction(async (tx) => {
    const lobby = await tx.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
    const existing = await tx.lobbyMembership.findUnique({ where: { lobbyId_userId: { lobbyId, userId } } });
    if (existing) throw new Error('ALREADY_MEMBER');
    const membership = await tx.lobbyMembership.create({ data: { lobbyId, userId, role: 'MEMBER', defaultPoints: lobby.defaultPoints, borrowed: 0n } });
    await tx.wallet.create({ data: { userId, contextType: 'LOBBY', contextId: lobbyId, balance: lobby.defaultPoints } });
    await tx.pointLedger.create({ data: { userId, contextType: 'LOBBY', contextId: lobbyId, type: 'LOBBY_DEFAULT', amount: lobby.defaultPoints, balanceAfter: lobby.defaultPoints, refType: 'LOBBY', refId: lobbyId } });
    return membership;
  });
}

/** Member requests to borrow points from the host pool (pending approval). */
export async function requestBorrow(prisma: PrismaClient, lobbyId: bigint, userId: bigint, amount: bigint) {
  if (amount <= 0n) throw new Error('INVALID_AMOUNT');
  const membership = await prisma.lobbyMembership.findUniqueOrThrow({ where: { lobbyId_userId: { lobbyId, userId } } });
  return prisma.borrowRequest.create({ data: { lobbyId, membershipId: membership.id, amount, status: 'PENDING' } });
}

/** Host approves/denies a borrow request. Approval credits the lobby wallet + bumps borrowed. */
export async function decideBorrow(prisma: PrismaClient, requestId: bigint, approve: boolean, decidedBy?: bigint) {
  return prisma.$transaction(async (tx) => {
    const req = await tx.borrowRequest.findUniqueOrThrow({ where: { id: requestId } });
    if (req.status !== 'PENDING') throw new Error('ALREADY_DECIDED');
    if (!approve) {
      await tx.borrowRequest.update({ where: { id: requestId }, data: { status: 'DENIED', decidedBy, decidedAt: new Date() } });
      return { status: 'DENIED' as const };
    }
    const m = await tx.lobbyMembership.findUniqueOrThrow({ where: { id: req.membershipId } });
    const wallet = await tx.wallet.findFirstOrThrow({ where: { userId: m.userId, contextType: 'LOBBY', contextId: m.lobbyId } });
    const newBal = wallet.balance + req.amount;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
    await tx.lobbyMembership.update({ where: { id: m.id }, data: { borrowed: { increment: req.amount } } });
    await tx.pointLedger.create({ data: { userId: m.userId, contextType: 'LOBBY', contextId: m.lobbyId, type: 'BORROW', amount: req.amount, balanceAfter: newBal, refType: 'BORROW', refId: req.id } });
    await tx.borrowRequest.update({ where: { id: requestId }, data: { status: 'APPROVED', decidedBy, decidedAt: new Date() } });
    return { status: 'APPROVED' as const, borrowed: m.borrowed + req.amount };
  });
}

export interface LobbyStanding {
  winnings: bigint; // net P&L from lobby bets (STAKE + SETTLE ledger)
  defaultPoints: bigint;
  borrowed: bigint;
  score: number; // winnings + default − borrowed
}

/** Compute a member's lobby standing. winnings = net of STAKE/SETTLE ledger in this lobby. */
export async function getLobbyStanding(prisma: PrismaClient, lobbyId: bigint, userId: bigint): Promise<LobbyStanding> {
  const m = await prisma.lobbyMembership.findUniqueOrThrow({ where: { lobbyId_userId: { lobbyId, userId } } });
  const betLedger = await prisma.pointLedger.findMany({
    where: { userId, contextType: 'LOBBY', contextId: lobbyId, type: { in: ['STAKE', 'SETTLE'] } },
  });
  const winnings = betLedger.reduce((sum, l) => sum + l.amount, 0n);
  return {
    winnings,
    defaultPoints: m.defaultPoints,
    borrowed: m.borrowed,
    score: lobbyScore(Number(winnings), Number(m.defaultPoints), Number(m.borrowed)),
  };
}
