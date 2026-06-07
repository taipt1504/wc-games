-- Admin can block betting on a match (server-enforced).
ALTER TABLE "Match" ADD COLUMN "bettingLocked" BOOLEAN NOT NULL DEFAULT false;
