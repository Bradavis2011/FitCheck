-- SEO Intelligence Migration
-- Adds SeoSnapshot and TargetKeyword models for the SEO growth engine

CREATE TABLE IF NOT EXISTS "seo_snapshots" (
  "id"                TEXT NOT NULL,
  "period"            TEXT NOT NULL,
  "total_clicks"      INTEGER NOT NULL DEFAULT 0,
  "total_impressions" INTEGER NOT NULL DEFAULT 0,
  "avg_position"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "avg_ctr"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "top_queries"       JSONB NOT NULL DEFAULT '[]',
  "opportunities"     JSONB NOT NULL DEFAULT '[]',
  "page_metrics"      JSONB NOT NULL DEFAULT '[]',
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seo_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "seo_snapshots_period_key" ON "seo_snapshots"("period");

CREATE TABLE IF NOT EXISTS "target_keywords" (
  "id"               TEXT NOT NULL,
  "keyword"          TEXT NOT NULL,
  "niche"            TEXT NOT NULL DEFAULT 'general',
  "intent"           TEXT NOT NULL DEFAULT 'informational',
  "difficulty"       TEXT NOT NULL DEFAULT 'medium',
  "status"           TEXT NOT NULL DEFAULT 'identified',
  "target_page_slug" TEXT,
  "current_position" DOUBLE PRECISION,
  "impressions"      INTEGER NOT NULL DEFAULT 0,
  "clicks"           INTEGER NOT NULL DEFAULT 0,
  "content_brief"    JSONB,
  "source_data"      JSONB,
  "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "target_keywords_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "target_keywords_keyword_key" ON "target_keywords"("keyword");
CREATE INDEX IF NOT EXISTS "target_keywords_niche_status_idx" ON "target_keywords"("niche", "status");
CREATE INDEX IF NOT EXISTS "target_keywords_status_idx" ON "target_keywords"("status");
