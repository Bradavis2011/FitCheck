-- Migration: 20260306000000_affiliate_and_events
-- Adds affiliate learning metadata + FashionEvent table

-- ── Affiliate click metadata ───────────────────────────────────────────────
ALTER TABLE "affiliate_impressions"
  ADD COLUMN IF NOT EXISTS "clicked_category" TEXT,
  ADD COLUMN IF NOT EXISTS "clicked_brand"    TEXT,
  ADD COLUMN IF NOT EXISTS "clicked_price"    DOUBLE PRECISION;

-- ── Per-user affiliate learning preferences ───────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "affiliate_preferences" JSONB;

-- ── Fashion events table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "fashion_events" (
  "id"              TEXT NOT NULL,
  "name"            TEXT NOT NULL,
  "city"            TEXT NOT NULL,
  "region"          TEXT,
  "date"            TIMESTAMP(3) NOT NULL,
  "end_date"        TIMESTAMP(3),
  "event_type"      TEXT NOT NULL,
  "dress_code"      TEXT,
  "description"     TEXT,
  "source"          TEXT NOT NULL DEFAULT 'gemini',
  "relevance_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "fashion_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fashion_events_name_date_key"
  ON "fashion_events" ("name", "date");

CREATE INDEX IF NOT EXISTS "fashion_events_city_date_idx"
  ON "fashion_events" ("city", "date");
