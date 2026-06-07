-- Lineup fields: formation + manager on Team, isStarter on Player (additive, nullable/defaulted).
ALTER TABLE "Team" ADD COLUMN "formation" TEXT;
ALTER TABLE "Team" ADD COLUMN "manager" TEXT;
ALTER TABLE "Player" ADD COLUMN "isStarter" BOOLEAN NOT NULL DEFAULT false;
