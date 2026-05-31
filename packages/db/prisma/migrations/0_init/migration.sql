-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'MOD', 'ADMIN', 'OPS', 'SUPER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ContextType" AS ENUM ('GLOBAL', 'LOBBY');

-- CreateEnum
CREATE TYPE "LedgerType" AS ENUM ('SIGNUP', 'DAILY', 'LOBBY_DEFAULT', 'STAKE', 'SETTLE', 'VOID', 'BORROW', 'REFERRAL', 'PURCHASE', 'ADMIN_ADJ', 'BONUS');

-- CreateEnum
CREATE TYPE "Outcome" AS ENUM ('HOME', 'DRAW', 'AWAY');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('OPEN', 'LOCKED', 'WON', 'LOST', 'VOID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchRound" AS ENUM ('GROUP', 'R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('DONE', 'PENDING_REVIEW', 'VOID');

-- CreateEnum
CREATE TYPE "OddsSource" AS ENUM ('API', 'AI', 'ADMIN', 'LOBBY');

-- CreateEnum
CREATE TYPE "LobbyScope" AS ENUM ('ALL', 'GROUP', 'R32', 'R16', 'QF', 'SF', 'FINAL', 'MATCH');

-- CreateEnum
CREATE TYPE "LobbyRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- CreateEnum
CREATE TYPE "NewsStatus" AS ENUM ('PENDING', 'PUBLISHED', 'REJECTED', 'UNPUBLISHED');

-- CreateEnum
CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'ACTIVATED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FutureMarket" AS ENUM ('CHAMPION', 'GOLDEN_BOOT', 'GOLDEN_BALL', 'FINALIST');

-- CreateEnum
CREATE TYPE "DuelStatus" AS ENUM ('PENDING', 'ACTIVE', 'DONE');

-- CreateEnum
CREATE TYPE "MessageKind" AS ENUM ('TEXT', 'SYSTEM', 'REACTION');

-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "tier" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordReset" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordReset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" BIGINT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "userId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" BIGSERIAL NOT NULL,
    "referrerId" BIGINT NOT NULL,
    "refereeId" BIGINT NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" BIGINT,
    "balance" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointLedger" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" BIGINT,
    "type" "LedgerType" NOT NULL,
    "amount" BIGINT NOT NULL,
    "balanceAfter" BIGINT NOT NULL,
    "refType" TEXT,
    "refId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" BIGINT,
    "matchId" BIGINT NOT NULL,
    "market" TEXT NOT NULL DEFAULT '1X2',
    "outcome" "Outcome" NOT NULL,
    "stake" BIGINT NOT NULL,
    "oddsSnapshot" DECIMAL(6,2) NOT NULL,
    "exactHome" INTEGER,
    "exactAway" INTEGER,
    "powerUp" TEXT,
    "status" "PredictionStatus" NOT NULL DEFAULT 'OPEN',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "matchId" BIGINT NOT NULL,
    "status" "SettlementStatus" NOT NULL,
    "result90" "Outcome",
    "settledAt" TIMESTAMP(3),
    "settledBy" TEXT NOT NULL DEFAULT 'SYSTEM',

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "PredictionUserStats" (
    "userId" BIGINT NOT NULL,
    "totalStaked" BIGINT NOT NULL DEFAULT 0,
    "totalReturned" BIGINT NOT NULL DEFAULT 0,
    "settledCount" INTEGER NOT NULL DEFAULT 0,
    "winCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PredictionUserStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Bracket" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "picks" JSONB NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "score" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bracket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FuturePick" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "market" "FutureMarket" NOT NULL,
    "selectionId" BIGINT NOT NULL,
    "stake" BIGINT NOT NULL,
    "oddsSnapshot" DECIMAL(6,2) NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'OPEN',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FuturePick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "flagUrl" TEXT,
    "fifaRank" INTEGER,
    "groupId" BIGINT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" BIGSERIAL NOT NULL,
    "teamId" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "number" INTEGER,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" BIGSERIAL NOT NULL,
    "round" "MatchRound" NOT NULL,
    "groupId" BIGINT,
    "homeTeamId" BIGINT NOT NULL,
    "awayTeamId" BIGINT NOT NULL,
    "venueId" BIGINT,
    "kickoffAt" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scoreHome90" INTEGER,
    "scoreAway90" INTEGER,
    "result90" "Outcome",
    "source" "OddsSource",
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchOdds" (
    "matchId" BIGINT NOT NULL,
    "mHome" DECIMAL(6,2) NOT NULL,
    "mDraw" DECIMAL(6,2) NOT NULL,
    "mAway" DECIMAL(6,2) NOT NULL,
    "source" "OddsSource" NOT NULL DEFAULT 'API',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchOdds_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "LobbyMatchOdds" (
    "id" BIGSERIAL NOT NULL,
    "lobbyId" BIGINT NOT NULL,
    "matchId" BIGINT NOT NULL,
    "mHome" DECIMAL(6,2) NOT NULL,
    "mDraw" DECIMAL(6,2) NOT NULL,
    "mAway" DECIMAL(6,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LobbyMatchOdds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" BIGSERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "tags" TEXT[],
    "sourceUrl" TEXT,
    "aiJobId" BIGINT,
    "status" "NewsStatus" NOT NULL DEFAULT 'PENDING',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NewsArticle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" BIGSERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "providerUsed" TEXT,
    "status" TEXT NOT NULL,
    "tokens" INTEGER,
    "cost" DECIMAL(10,4),
    "latencyMs" INTEGER,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiPreview" (
    "matchId" BIGINT NOT NULL,
    "content" JSONB NOT NULL,
    "provider" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiPreview_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "Lobby" (
    "id" BIGSERIAL NOT NULL,
    "ownerId" BIGINT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "inviteToken" TEXT NOT NULL,
    "scope" "LobbyScope" NOT NULL,
    "scopeRefId" BIGINT,
    "defaultPoints" BIGINT NOT NULL,
    "allowBorrow" BOOLEAN NOT NULL DEFAULT true,
    "manualOdds" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lobby_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyMembership" (
    "id" BIGSERIAL NOT NULL,
    "lobbyId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "role" "LobbyRole" NOT NULL DEFAULT 'MEMBER',
    "defaultPoints" BIGINT NOT NULL,
    "borrowed" BIGINT NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyMembership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorrowRequest" (
    "id" BIGSERIAL NOT NULL,
    "lobbyId" BIGINT NOT NULL,
    "membershipId" BIGINT NOT NULL,
    "amount" BIGINT NOT NULL,
    "status" "BorrowStatus" NOT NULL DEFAULT 'PENDING',
    "decidedBy" BIGINT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BorrowRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LobbyMessage" (
    "id" BIGSERIAL NOT NULL,
    "lobbyId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "MessageKind" NOT NULL DEFAULT 'TEXT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LobbyMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "userId" BIGINT NOT NULL,
    "checkinStreak" INTEGER NOT NULL DEFAULT 0,
    "winStreak" INTEGER NOT NULL DEFAULT 0,
    "lastCheckinDate" TIMESTAMP(3),

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "rule" JSONB NOT NULL,
    "reward" BIGINT NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionProgress" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "missionId" BIGINT NOT NULL,
    "date" DATE NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MissionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "condition" JSONB NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserAchievement" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "achievementId" BIGINT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPref" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPref_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Duel" (
    "id" BIGSERIAL NOT NULL,
    "challengerId" BIGINT NOT NULL,
    "opponentId" BIGINT NOT NULL,
    "scope" TEXT NOT NULL,
    "status" "DuelStatus" NOT NULL DEFAULT 'PENDING',
    "winnerId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Duel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" BIGSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "price" BIGINT NOT NULL,

    CONSTRAINT "CosmeticItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "itemId" BIGINT NOT NULL,
    "equipped" BOOLEAN NOT NULL DEFAULT false,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PowerUp" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PowerUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Parlay" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "stake" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Parlay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParlayLeg" (
    "id" BIGSERIAL NOT NULL,
    "parlayId" BIGINT NOT NULL,
    "matchId" BIGINT NOT NULL,
    "outcome" "Outcome" NOT NULL,
    "oddsSnapshot" DECIMAL(6,2) NOT NULL,
    "result" TEXT,

    CONSTRAINT "ParlayLeg_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroPrediction" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "matchId" BIGINT NOT NULL,
    "market" TEXT NOT NULL,
    "pick" TEXT NOT NULL,
    "stake" BIGINT NOT NULL,
    "oddsSnapshot" DECIMAL(6,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MicroPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskFlag" (
    "id" BIGSERIAL NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" BIGINT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RiskFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" BIGSERIAL NOT NULL,
    "adminId" BIGINT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" BIGINT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFile" (
    "id" BIGSERIAL NOT NULL,
    "subject" TEXT NOT NULL,
    "evidenceRef" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordReset_tokenHash_key" ON "PasswordReset"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordReset_userId_idx" ON "PasswordReset"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_actorType_actorId_createdAt_idx" ON "AuditLog"("actorType", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_ip_idx" ON "AuditLog"("ip");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_refereeId_key" ON "Referral"("refereeId");

-- CreateIndex
CREATE INDEX "Referral_referrerId_idx" ON "Referral"("referrerId");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_userId_contextType_contextId_key" ON "Wallet"("userId", "contextType", "contextId");

-- CreateIndex
CREATE INDEX "PointLedger_userId_contextType_contextId_createdAt_idx" ON "PointLedger"("userId", "contextType", "contextId", "createdAt");

-- CreateIndex
CREATE INDEX "PointLedger_refType_refId_idx" ON "PointLedger"("refType", "refId");

-- CreateIndex
CREATE INDEX "Prediction_matchId_status_idx" ON "Prediction"("matchId", "status");

-- CreateIndex
CREATE INDEX "Prediction_userId_contextType_contextId_createdAt_idx" ON "Prediction"("userId", "contextType", "contextId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Prediction_userId_contextType_contextId_matchId_market_key" ON "Prediction"("userId", "contextType", "contextId", "matchId", "market");

-- CreateIndex
CREATE UNIQUE INDEX "Bracket_userId_key" ON "Bracket"("userId");

-- CreateIndex
CREATE INDEX "FuturePick_userId_idx" ON "FuturePick"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_name_key" ON "Group"("name");

-- CreateIndex
CREATE INDEX "Player_teamId_idx" ON "Player"("teamId");

-- CreateIndex
CREATE INDEX "Match_kickoffAt_idx" ON "Match"("kickoffAt");

-- CreateIndex
CREATE INDEX "Match_status_idx" ON "Match"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMatchOdds_lobbyId_matchId_key" ON "LobbyMatchOdds"("lobbyId", "matchId");

-- CreateIndex
CREATE INDEX "NewsArticle_status_publishedAt_idx" ON "NewsArticle"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lobby_inviteToken_key" ON "Lobby"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "LobbyMembership_lobbyId_userId_key" ON "LobbyMembership"("lobbyId", "userId");

-- CreateIndex
CREATE INDEX "BorrowRequest_lobbyId_idx" ON "BorrowRequest"("lobbyId");

-- CreateIndex
CREATE INDEX "LobbyMessage_lobbyId_createdAt_idx" ON "LobbyMessage"("lobbyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_code_key" ON "Mission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MissionProgress_userId_missionId_date_key" ON "MissionProgress"("userId", "missionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPref_userId_type_channel_key" ON "NotificationPref"("userId", "type", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "CosmeticItem_code_key" ON "CosmeticItem"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_itemId_key" ON "UserCosmetic"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "PowerUp_userId_type_key" ON "PowerUp"("userId", "type");

-- CreateIndex
CREATE INDEX "ParlayLeg_matchId_idx" ON "ParlayLeg"("matchId");

-- CreateIndex
CREATE INDEX "RiskFlag_targetType_targetId_idx" ON "RiskFlag"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchOdds" ADD CONSTRAINT "MatchOdds_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMembership" ADD CONSTRAINT "LobbyMembership_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMembership" ADD CONSTRAINT "LobbyMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LobbyMessage" ADD CONSTRAINT "LobbyMessage_lobbyId_fkey" FOREIGN KEY ("lobbyId") REFERENCES "Lobby"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParlayLeg" ADD CONSTRAINT "ParlayLeg_parlayId_fkey" FOREIGN KEY ("parlayId") REFERENCES "Parlay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

