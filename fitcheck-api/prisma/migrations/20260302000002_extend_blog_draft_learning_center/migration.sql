-- Extend BlogDraft model for Learning Center
-- Adds content type, category, SEO fields, gating metadata, and TikTok script storage

-- Guard: create base table if it doesn't exist yet (fresh-DB ordering fix —
-- blog_drafts is formally created in 20260304000000; on Railway it pre-existed,
-- but CI runs migrations in strict timestamp order so we need it here first).
CREATE TABLE IF NOT EXISTS "blog_drafts" (
  "id"               TEXT      NOT NULL DEFAULT gen_random_uuid(),
  "title"            TEXT      NOT NULL,
  "slug"             TEXT      NOT NULL UNIQUE,
  "content"          TEXT      NOT NULL,
  "meta_description" TEXT,
  "og_title"         TEXT,
  "status"           TEXT      NOT NULL DEFAULT 'draft',
  "source_data"      JSONB,
  "created_at"       TIMESTAMP NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);

ALTER TABLE "blog_drafts"
  ADD COLUMN IF NOT EXISTS "content_type" TEXT NOT NULL DEFAULT 'article',
  ADD COLUMN IF NOT EXISTS "category"     TEXT,
  ADD COLUMN IF NOT EXISTS "excerpt"      TEXT,
  ADD COLUMN IF NOT EXISTS "seo_keywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "trend_period" TEXT,
  ADD COLUMN IF NOT EXISTS "source_rule_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "script_data"  JSONB;

-- Indexes for learning center content queries
CREATE INDEX IF NOT EXISTS "blog_drafts_content_type_status_idx" ON "blog_drafts" ("content_type", "status");
CREATE INDEX IF NOT EXISTS "blog_drafts_published_at_idx"         ON "blog_drafts" ("published_at");
