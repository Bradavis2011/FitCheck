-- Extend BlogDraft model for Learning Center
-- Adds content type, category, SEO fields, gating metadata, and TikTok script storage

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
