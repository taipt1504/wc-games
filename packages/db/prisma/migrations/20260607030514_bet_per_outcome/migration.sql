-- Allow one bet per OUTCOME (not just per market) on a match/context — hedging A/X/2.
DROP INDEX "Prediction_userId_contextType_contextId_matchId_market_key";
CREATE UNIQUE INDEX "prediction_ctx_match_market_outcome_uq" ON "Prediction"("userId", "contextType", "contextId", "matchId", "market", "outcome");
