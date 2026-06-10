-- Top scorers (Golden Boot), competition-wide, synced from football-data.org /scorers.
CREATE TABLE "Scorer" (
    "id" BIGSERIAL NOT NULL,
    "externalId" INTEGER NOT NULL,
    "teamId" BIGINT,
    "name" TEXT NOT NULL,
    "teamName" TEXT,
    "goals" INTEGER NOT NULL DEFAULT 0,
    "assists" INTEGER NOT NULL DEFAULT 0,
    "penalties" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Scorer_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Scorer_externalId_key" ON "Scorer"("externalId");
