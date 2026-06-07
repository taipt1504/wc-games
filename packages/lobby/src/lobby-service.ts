/**
 * @wc/lobby — Private lobby + borrow service (PRD §03D / §04.6 / FR-LOBBY-01..07).
 * Each lobby is an isolated wallet context (contextType=LOBBY, contextId=lobbyId).
 * Standing score = winnings + default − borrowed (borrowing is debt, doesn't raise rank).
 */
import type { PrismaClient, LobbyScope, LobbyMatchOdds, Prediction } from '@wc/db';
import { lobbyScore } from '@wc/core';
import type { Pick1X2 } from '@wc/core';

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

/** Transfer lobby host: swap ownerId + role of old/new owner atomically. */
export async function transferHost(
  prisma: PrismaClient,
  lobbyId: bigint,
  currentOwnerId: bigint,
  newOwnerUserId: bigint,
) {
  const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
  if (lobby.ownerId !== currentOwnerId) throw new Error('NOT_OWNER');
  const newOwnerMembership = await prisma.lobbyMembership.findUnique({
    where: { lobbyId_userId: { lobbyId, userId: newOwnerUserId } },
  });
  if (!newOwnerMembership) throw new Error('NOT_A_MEMBER');
  return prisma.$transaction(async (tx) => {
    const updatedLobby = await tx.lobby.update({ where: { id: lobbyId }, data: { ownerId: newOwnerUserId } });
    await tx.lobbyMembership.update({
      where: { lobbyId_userId: { lobbyId, userId: newOwnerUserId } },
      data: { role: 'OWNER' },
    });
    await tx.lobbyMembership.update({
      where: { lobbyId_userId: { lobbyId, userId: currentOwnerId } },
      data: { role: 'MEMBER' },
    });
    return updatedLobby;
  });
}

/** Kick a member from a lobby. Only the owner may kick; the owner cannot kick themselves. */
export async function kickMember(
  prisma: PrismaClient,
  lobbyId: bigint,
  ownerId: bigint,
  targetUserId: bigint,
) {
  const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
  if (lobby.ownerId !== ownerId) throw new Error('NOT_OWNER');
  if (targetUserId === ownerId) throw new Error('CANNOT_KICK_OWNER');
  const membership = await prisma.lobbyMembership.findUnique({
    where: { lobbyId_userId: { lobbyId, userId: targetUserId } },
  });
  if (!membership) throw new Error('NOT_A_MEMBER');
  await prisma.lobbyMembership.delete({ where: { id: membership.id } });
  return { ok: true };
}

export interface LobbyStanding {
  winnings: bigint; // net P&L from lobby bets (STAKE + SETTLE ledger)
  defaultPoints: bigint;
  borrowed: bigint;
  balance: bigint; // actual spendable lobby wallet (default + winnings + borrowed + adjustments)
  score: number; // winnings + default − borrowed (rank; borrow is debt)
}

// ===================== LOBBY-07: per-match odds override + lobby-context betting =====================

/** Set (upsert) per-lobby odds for a match. Only the lobby owner may call this. */
export async function setLobbyOdds(
  prisma: PrismaClient,
  lobbyId: bigint,
  ownerId: bigint,
  matchId: bigint,
  odds: { mHome: number; mDraw: number; mAway: number },
): Promise<LobbyMatchOdds> {
  const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
  if (lobby.ownerId !== ownerId) throw new Error('NOT_OWNER');
  const row = await prisma.lobbyMatchOdds.upsert({
    where: { lobbyId_matchId: { lobbyId, matchId } },
    create: { lobbyId, matchId, mHome: odds.mHome, mDraw: odds.mDraw, mAway: odds.mAway },
    update: { mHome: odds.mHome, mDraw: odds.mDraw, mAway: odds.mAway },
  });
  await prisma.lobby.update({ where: { id: lobbyId }, data: { manualOdds: true } });
  return row;
}

export interface LobbyOddsResult {
  mHome: number;
  mDraw: number;
  mAway: number;
  source: 'LOBBY' | 'GLOBAL';
}

/** Return the effective odds for a match inside a lobby (lobby override → global → null). */
export async function getLobbyOdds(
  prisma: PrismaClient,
  lobbyId: bigint,
  matchId: bigint,
): Promise<LobbyOddsResult | null> {
  const lobbyOdds = await prisma.lobbyMatchOdds.findUnique({ where: { lobbyId_matchId: { lobbyId, matchId } } });
  if (lobbyOdds) {
    return { mHome: Number(lobbyOdds.mHome), mDraw: Number(lobbyOdds.mDraw), mAway: Number(lobbyOdds.mAway), source: 'LOBBY' };
  }
  const globalOdds = await prisma.matchOdds.findUnique({ where: { matchId } });
  if (globalOdds) {
    return { mHome: Number(globalOdds.mHome), mDraw: Number(globalOdds.mDraw), mAway: Number(globalOdds.mAway), source: 'GLOBAL' };
  }
  return null;
}

/** Return all lobby odds overrides for a lobby, keyed by matchId string. */
export async function listLobbyOdds(
  prisma: PrismaClient,
  lobbyId: bigint,
): Promise<Record<string, { mHome: number; mDraw: number; mAway: number }>> {
  const rows = await prisma.lobbyMatchOdds.findMany({ where: { lobbyId } });
  const map: Record<string, { mHome: number; mDraw: number; mAway: number }> = {};
  for (const r of rows) {
    map[String(r.matchId)] = { mHome: Number(r.mHome), mDraw: Number(r.mDraw), mAway: Number(r.mAway) };
  }
  return map;
}

export interface PlaceLobbyBetInput {
  lobbyId: bigint;
  userId: bigint;
  matchId: bigint;
  pick: Pick1X2;
  stake: bigint;
}

const PICK_TO_OUTCOME: Record<Pick1X2, 'HOME' | 'DRAW' | 'AWAY'> = { '1': 'HOME', X: 'DRAW', '2': 'AWAY' };

/** Place a lobby-context 1X2 bet: escrow from lobby wallet, create OPEN prediction, write STAKE ledger. */
export async function placeLobbyBet(prisma: PrismaClient, input: PlaceLobbyBetInput): Promise<Prediction> {
  // Verify membership
  const membership = await prisma.lobbyMembership.findUnique({
    where: { lobbyId_userId: { lobbyId: input.lobbyId, userId: input.userId } },
  });
  if (!membership) throw new Error('NOT_A_MEMBER');

  // Load match and check status
  const match = await prisma.match.findUnique({ where: { id: input.matchId } });
  if (!match || match.status !== 'SCHEDULED' || match.kickoffAt.getTime() <= Date.now() || match.bettingLocked) throw new Error('BET_LOCKED');

  // Resolve odds
  const odds = await getLobbyOdds(prisma, input.lobbyId, input.matchId);
  if (!odds) throw new Error('ODDS_UNAVAILABLE');

  const outcome = PICK_TO_OUTCOME[input.pick];
  const multiplier = outcome === 'HOME' ? odds.mHome : outcome === 'DRAW' ? odds.mDraw : odds.mAway;

  // One bet per outcome (hedging A/X/2 is allowed; the same outcome twice is not).
  const dupe = await prisma.prediction.findFirst({
    where: { userId: input.userId, contextType: 'LOBBY', contextId: input.lobbyId, matchId: input.matchId, market: '1X2', outcome, status: 'OPEN' },
  });
  if (dupe) throw new Error('ALREADY_BET_OUTCOME');

  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findFirstOrThrow({
      where: { userId: input.userId, contextType: 'LOBBY', contextId: input.lobbyId },
    });
    if (wallet.balance < input.stake) throw new Error('INSUFFICIENT_BALANCE');

    const newBal = wallet.balance - input.stake;
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });

    const prediction = await tx.prediction.create({
      data: {
        userId: input.userId, contextType: 'LOBBY', contextId: input.lobbyId,
        matchId: input.matchId, market: '1X2', outcome, stake: input.stake,
        oddsSnapshot: multiplier, status: 'OPEN',
      },
    });
    await tx.pointLedger.create({
      data: {
        userId: input.userId, contextType: 'LOBBY', contextId: input.lobbyId,
        type: 'STAKE', amount: -input.stake, balanceAfter: newBal,
        refType: 'PREDICTION', refId: prediction.id,
      },
    });
    return prediction;
  });
}

/** Host grants/deducts a member's lobby points (FR-LOBBY host control). Audited via ADMIN_ADJ ledger. */
export async function adjustMemberPoints(
  prisma: PrismaClient,
  lobbyId: bigint,
  hostId: bigint,
  memberUserId: bigint,
  delta: bigint,
): Promise<{ balance: bigint }> {
  const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
  if (lobby.ownerId !== hostId) throw new Error('NOT_HOST');
  const membership = await prisma.lobbyMembership.findUnique({ where: { lobbyId_userId: { lobbyId, userId: memberUserId } } });
  if (!membership) throw new Error('NOT_A_MEMBER');
  return prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findFirstOrThrow({ where: { userId: memberUserId, contextType: 'LOBBY', contextId: lobbyId } });
    const newBal = wallet.balance + delta;
    if (newBal < 0n) throw new Error('INSUFFICIENT_BALANCE');
    await tx.wallet.update({ where: { id: wallet.id }, data: { balance: newBal } });
    await tx.pointLedger.create({
      data: { userId: memberUserId, contextType: 'LOBBY', contextId: lobbyId, type: 'ADMIN_ADJ', amount: delta, balanceAfter: newBal, refType: 'LOBBY', refId: lobbyId },
    });
    return { balance: newBal };
  });
}

/** Compute a member's lobby standing. winnings = net of STAKE/SETTLE ledger in this lobby. */
export async function getLobbyStanding(prisma: PrismaClient, lobbyId: bigint, userId: bigint): Promise<LobbyStanding> {
  const m = await prisma.lobbyMembership.findUniqueOrThrow({ where: { lobbyId_userId: { lobbyId, userId } } });
  const betLedger = await prisma.pointLedger.findMany({
    where: { userId, contextType: 'LOBBY', contextId: lobbyId, type: { in: ['STAKE', 'SETTLE'] } },
  });
  const winnings = betLedger.reduce((sum, l) => sum + l.amount, 0n);
  const wallet = await prisma.wallet.findFirst({ where: { userId, contextType: 'LOBBY', contextId: lobbyId } });
  return {
    winnings,
    defaultPoints: m.defaultPoints,
    borrowed: m.borrowed,
    balance: wallet?.balance ?? 0n,
    score: lobbyScore(Number(winnings), Number(m.defaultPoints), Number(m.borrowed)),
  };
}
