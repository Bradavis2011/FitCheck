-- Add UTM attribution to users (first touch, set once)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "attribution" JSONB;

-- Add tracking URL to social posts
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "tracking_url" TEXT;

-- Create ASO snapshots table
CREATE TABLE IF NOT EXISTS "aso_snapshots" (
  "id"           TEXT NOT NULL PRIMARY KEY,
  "store"        TEXT NOT NULL,
  "keyword"      TEXT NOT NULL,
  "difficulty"   DOUBLE PRECISION,
  "traffic"      DOUBLE PRECISION,
  "current_rank" INTEGER,
  "rank_change"  INTEGER,
  "competitors"  JSONB,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "aso_snapshots_keyword_store_created_at_idx"
  ON "aso_snapshots"("keyword", "store", "created_at");

-- Add attribution source metadata to conversion signals
ALTER TABLE "conversion_signals" ADD COLUMN IF NOT EXISTS "signal_metadata" JSONB;
