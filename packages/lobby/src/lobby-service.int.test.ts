import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@wc/db';
import { createLobby, joinLobby, requestBorrow, decideBorrow, getLobbyStanding, transferHost, kickMember, setLobbyOdds, getLobbyOdds, listLobbyOdds, placeLobbyBet } from './lobby-service';
import { settleMatch } from '@wc/prediction';

const prisma = new PrismaClient();

async function clean() {
  await prisma.borrowRequest.deleteMany();
  await prisma.lobbyMatchOdds.deleteMany();
  await prisma.pointLedger.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.settlement.deleteMany();
  await prisma.predictionUserStats.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.wallet.deleteMany();
  await prisma.lobbyMembership.deleteMany();
  await prisma.lobby.deleteMany();
  await prisma.matchOdds.deleteMany();
  await prisma.match.deleteMany();
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

// ===================== LOBBY-07: odds override + lobby-context betting =====================

describe('setLobbyOdds + getLobbyOdds + placeLobbyBet + settle (integration · Postgres)', () => {
  let lobbyId: bigint;
  let ownerId: bigint;
  let memberId: bigint;
  let matchId: bigint;
  let globalMatchId: bigint; // match with global odds only

  beforeAll(async () => {
    await clean();

    const owner = await prisma.user.create({ data: { email: 'odds-owner@lobby.io', passwordHash: 'x' } });
    ownerId = owner.id;
    const lobby = await createLobby(prisma, ownerId, { name: 'Odds Test Lobby', scope: 'GROUP', defaultPoints: 2000n, inviteToken: 'ODDST1' });
    lobbyId = lobby.id;

    const member = await prisma.user.create({ data: { email: 'odds-member@lobby.io', passwordHash: 'x' } });
    memberId = member.id;
    await joinLobby(prisma, lobbyId, memberId);

    // A scheduled match in the future (no global odds — lobby will provide)
    const m = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 10n, awayTeamId: 11n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    matchId = m.id;

    // A second match that has global odds but no lobby override
    const gm = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 12n, awayTeamId: 13n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    globalMatchId = gm.id;
    await prisma.matchOdds.create({ data: { matchId: globalMatchId, mHome: 1.2, mDraw: 0.9, mAway: 1.8, source: 'API' } });
  });

  afterAll(async () => { await clean(); await prisma.$disconnect(); });

  it('setLobbyOdds: owner upserts odds and sets manualOdds=true', async () => {
    const row = await setLobbyOdds(prisma, lobbyId, ownerId, matchId, { mHome: 3.0, mDraw: 1.5, mAway: 2.0 });
    expect(Number(row.mHome)).toBe(3.0);
    expect(Number(row.mDraw)).toBe(1.5);
    expect(Number(row.mAway)).toBe(2.0);

    const lobby = await prisma.lobby.findUniqueOrThrow({ where: { id: lobbyId } });
    expect(lobby.manualOdds).toBe(true);
  });

  it('setLobbyOdds: non-owner throws NOT_OWNER', async () => {
    await expect(setLobbyOdds(prisma, lobbyId, memberId, matchId, { mHome: 1.0, mDraw: 1.0, mAway: 1.0 })).rejects.toThrow('NOT_OWNER');
  });

  it('setLobbyOdds: upsert overwrites previous values', async () => {
    const row = await setLobbyOdds(prisma, lobbyId, ownerId, matchId, { mHome: 3.5, mDraw: 1.2, mAway: 2.1 });
    expect(Number(row.mHome)).toBe(3.5);
    // Restore for subsequent tests
    await setLobbyOdds(prisma, lobbyId, ownerId, matchId, { mHome: 3.0, mDraw: 1.5, mAway: 2.0 });
  });

  it('getLobbyOdds: returns lobby override when set (source LOBBY)', async () => {
    const o = await getLobbyOdds(prisma, lobbyId, matchId);
    expect(o).not.toBeNull();
    expect(o!.source).toBe('LOBBY');
    expect(o!.mHome).toBe(3.0);
    expect(o!.mDraw).toBe(1.5);
    expect(o!.mAway).toBe(2.0);
  });

  it('getLobbyOdds: falls back to global MatchOdds when no override (source GLOBAL)', async () => {
    const o = await getLobbyOdds(prisma, lobbyId, globalMatchId);
    expect(o).not.toBeNull();
    expect(o!.source).toBe('GLOBAL');
    expect(o!.mHome).toBe(1.2);
  });

  it('getLobbyOdds: returns null when neither lobby nor global odds exist', async () => {
    const noOddsMatch = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 20n, awayTeamId: 21n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    const o = await getLobbyOdds(prisma, lobbyId, noOddsMatch.id);
    expect(o).toBeNull();
  });

  it('listLobbyOdds: returns all overrides as a map keyed by matchId string', async () => {
    const map = await listLobbyOdds(prisma, lobbyId);
    expect(map[String(matchId)]).toBeDefined();
    expect(map[String(matchId)].mHome).toBe(3.0);
    // globalMatchId has no lobby override, so it should not appear
    expect(map[String(globalMatchId)]).toBeUndefined();
  });

  it('placeLobbyBet: non-member throws NOT_A_MEMBER', async () => {
    const stranger = await prisma.user.create({ data: { email: 'stranger-o@lobby.io', passwordHash: 'x' } });
    await expect(placeLobbyBet(prisma, { lobbyId, userId: stranger.id, matchId, pick: '1', stake: 100n })).rejects.toThrow('NOT_A_MEMBER');
  });

  it('placeLobbyBet: locked match throws BET_LOCKED', async () => {
    const locked = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 30n, awayTeamId: 31n, kickoffAt: new Date(Date.now() - 60_000), status: 'SCHEDULED' },
    });
    await setLobbyOdds(prisma, lobbyId, ownerId, locked.id, { mHome: 1.0, mDraw: 1.0, mAway: 1.0 });
    await expect(placeLobbyBet(prisma, { lobbyId, userId: memberId, matchId: locked.id, pick: '1', stake: 100n })).rejects.toThrow('BET_LOCKED');
  });

  it('placeLobbyBet: no odds throws ODDS_UNAVAILABLE', async () => {
    const noOddsMatch = await prisma.match.create({
      data: { round: 'GROUP', homeTeamId: 40n, awayTeamId: 41n, kickoffAt: new Date(Date.now() + 3_600_000), status: 'SCHEDULED' },
    });
    await expect(placeLobbyBet(prisma, { lobbyId, userId: memberId, matchId: noOddsMatch.id, pick: '1', stake: 100n })).rejects.toThrow('ODDS_UNAVAILABLE');
  });

  it('placeLobbyBet: member bets 100 on HOME (mHome=3.0) — lobby wallet debited, prediction correct', async () => {
    const walletBefore = await prisma.wallet.findFirstOrThrow({ where: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId } });
    const pred = await placeLobbyBet(prisma, { lobbyId, userId: memberId, matchId, pick: '1', stake: 100n });

    expect(pred.contextType).toBe('LOBBY');
    expect(pred.contextId).toBe(lobbyId);
    expect(pred.outcome).toBe('HOME');
    expect(pred.stake).toBe(100n);
    expect(Number(pred.oddsSnapshot)).toBe(3.0);
    expect(pred.status).toBe('OPEN');

    const walletAfter = await prisma.wallet.findFirstOrThrow({ where: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId } });
    expect(walletAfter.balance).toBe(walletBefore.balance - 100n);

    const ledger = await prisma.pointLedger.findMany({ where: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId, type: 'STAKE', refId: pred.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(-100n);
  });

  it('placeLobbyBet: insufficient balance throws INSUFFICIENT_BALANCE', async () => {
    // Member has 2000 - 100 = 1900 left; bet 3000 should fail
    await expect(placeLobbyBet(prisma, { lobbyId, userId: memberId, matchId: globalMatchId, pick: '1', stake: 3000n })).rejects.toThrow('INSUFFICIENT_BALANCE');
  });

  it('settle integration: after settleMatch HOME win, getLobbyStanding winnings reflect payout', async () => {
    // Settle the match: HOME wins 2-1.
    // oddsSnapshot = 3.0; payout = round(100*(1+3.0)) = 400, plus underdog bonus: round(400*0.15) = 60 → 460
    // winnings = STAKE(-100) + SETTLE(+460) = 360
    const result = await settleMatch(prisma, matchId, { home: 2, away: 1 });
    expect(result.alreadySettled).toBe(false);
    expect(result.result).toBe('HOME');

    const standing = await getLobbyStanding(prisma, lobbyId, memberId);
    // winnings = net P&L from STAKE + SETTLE ledger
    expect(standing.winnings).toBe(360n); // -100 + 460

    // Wallet should have been credited with the full payout
    const wallet = await prisma.wallet.findFirstOrThrow({ where: { userId: memberId, contextType: 'LOBBY', contextId: lobbyId } });
    // walletBefore bet: 2000, after bet: 1900, after settle: 1900 + 460 = 2360
    expect(wallet.balance).toBe(2360n);
  });
});
