-- Special (novelty) prediction markets.
CREATE TYPE "SpecialOutcome" AS ENUM ('YES', 'NO');
CREATE TYPE "SpecialStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED');
CREATE TYPE "SpecialPredStatus" AS ENUM ('OPEN', 'WON', 'LOST');

CREATE TABLE "SpecialMarket" (
    "id" BIGSERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleVi" TEXT,
    "subtitle" TEXT,
    "subtitleVi" TEXT,
    "status" "SpecialStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedOutcome" "SpecialOutcome",
    "oddsYes" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "oddsNo" DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialMarket_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpecialMarket_key_key" ON "SpecialMarket"("key");

CREATE TABLE "SpecialLobbyOdds" (
    "id" BIGSERIAL NOT NULL,
    "lobbyId" BIGINT NOT NULL,
    "marketId" BIGINT NOT NULL,
    "oddsYes" DECIMAL(6,2) NOT NULL,
    "oddsNo" DECIMAL(6,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SpecialLobbyOdds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpecialLobbyOdds_lobbyId_marketId_key" ON "SpecialLobbyOdds"("lobbyId", "marketId");

CREATE TABLE "SpecialPrediction" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "contextType" "ContextType" NOT NULL,
    "contextId" BIGINT,
    "marketId" BIGINT NOT NULL,
    "pick" "SpecialOutcome" NOT NULL,
    "stake" BIGINT NOT NULL,
    "oddsSnapshot" DECIMAL(6,2) NOT NULL,
    "status" "SpecialPredStatus" NOT NULL DEFAULT 'OPEN',
    "payout" BIGINT NOT NULL DEFAULT 0,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpecialPrediction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpecialPrediction_marketId_status_idx" ON "SpecialPrediction"("marketId", "status");
CREATE INDEX "SpecialPrediction_userId_contextType_contextId_idx" ON "SpecialPrediction"("userId", "contextType", "contextId");
