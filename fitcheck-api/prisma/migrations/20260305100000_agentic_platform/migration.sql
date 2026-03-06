-- Migration: Agentic Platform Phase 1
-- Adds city, primaryOccasions, styleNoGos, honestyLevel, styleDirection to users
-- Adds UserFeedbackPattern model for Feedback Reframe Engine

-- User: location + extended style preferences
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "primary_occasions" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "honesty_level" TEXT,
  ADD COLUMN IF NOT EXISTS "style_no_gos" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "style_direction" TEXT;

-- UserFeedbackPattern: per-user per-category feedback engagement tracking
CREATE TABLE IF NOT EXISTS "user_feedback_patterns" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "user_id"        TEXT NOT NULL,
  "category"       TEXT NOT NULL,
  "times_advised"  INTEGER NOT NULL DEFAULT 0,
  "times_acted_on" INTEGER NOT NULL DEFAULT 0,
  "last_advised_at" TIMESTAMP(3),
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_feedback_patterns_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one pattern record per user per category
ALTER TABLE "user_feedback_patterns"
  ADD CONSTRAINT "user_feedback_patterns_user_id_category_key"
  UNIQUE ("user_id", "category");

-- Foreign key to users
ALTER TABLE "user_feedback_patterns"
  ADD CONSTRAINT "user_feedback_patterns_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Index for efficient user lookups
CREATE INDEX IF NOT EXISTS "user_feedback_patterns_user_id_idx" ON "user_feedback_patterns"("user_id");
