-- Bilingual news content: AI stores EN + VI; public API serves by ?locale, falls back to EN when null.
ALTER TABLE "NewsArticle" ADD COLUMN "titleVi" TEXT;
ALTER TABLE "NewsArticle" ADD COLUMN "bodyVi" TEXT;
