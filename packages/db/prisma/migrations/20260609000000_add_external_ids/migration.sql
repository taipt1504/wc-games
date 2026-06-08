-- Add football-data.org external id mapping columns (nullable, unique).
ALTER TABLE "Team"   ADD COLUMN "externalId" INTEGER;
ALTER TABLE "Player" ADD COLUMN "externalId" INTEGER;
ALTER TABLE "Match"  ADD COLUMN "externalId" INTEGER;
CREATE UNIQUE INDEX "Team_externalId_key"   ON "Team"("externalId");
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");
CREATE UNIQUE INDEX "Match_externalId_key"  ON "Match"("externalId");
