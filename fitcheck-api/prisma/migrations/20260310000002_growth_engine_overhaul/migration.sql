-- Growth Engine Overhaul Migration
-- Phases 1, 2, 3: Affiliate program, Reddit image tracking, Comment-first pipeline

-- Phase 2: RedditThread — image tracking + engagement signals
ALTER TABLE "reddit_threads" ADD COLUMN IF NOT EXISTS "image_url" TEXT;
ALTER TABLE "reddit_threads" ADD COLUMN IF NOT EXISTS "has_image" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reddit_threads" ADD COLUMN IF NOT EXISTS "analysis_used" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reddit_threads" ADD COLUMN IF NOT EXISTS "comment_karma" INTEGER;
ALTER TABLE "reddit_threads" ADD COLUMN IF NOT EXISTS "author_replied" BOOLEAN NOT NULL DEFAULT false;

-- Phase 1: Creator — affiliate program fields
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "user_id" TEXT;
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.30;
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "total_earned" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "pending_payout" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "creators" ADD COLUMN IF NOT EXISTS "paypal_email" TEXT;

-- Phase 1: Unique constraint on Creator.user_id
CREATE UNIQUE INDEX IF NOT EXISTS "creators_user_id_key" ON "creators"("user_id");

-- Phase 1: CreatorCommission model
CREATE TABLE IF NOT EXISTS "creator_commissions" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "referred_user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "gross_revenue" DOUBLE PRECISION NOT NULL,
    "net_revenue" DOUBLE PRECISION NOT NULL,
    "commission_amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accrued',
    "period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paid_at" TIMESTAMP(3),

    CONSTRAINT "creator_commissions_pkey" PRIMARY KEY ("id")
);

-- Phase 1: Indexes for CreatorCommission
CREATE UNIQUE INDEX IF NOT EXISTS "creator_commissions_referred_user_id_event_type_period_key"
    ON "creator_commissions"("referred_user_id", "event_type", "period");

CREATE INDEX IF NOT EXISTS "creator_commissions_creator_id_status_idx"
    ON "creator_commissions"("creator_id", "status");

-- Phase 1: Foreign key constraints for CreatorCommission
ALTER TABLE "creator_commissions"
    ADD CONSTRAINT "creator_commissions_creator_id_fkey"
    FOREIGN KEY ("creator_id") REFERENCES "creators"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "creator_commissions"
    ADD CONSTRAINT "creator_commissions_referred_user_id_fkey"
    FOREIGN KEY ("referred_user_id") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Phase 1: Foreign key from Creator to User
ALTER TABLE "creators"
    ADD CONSTRAINT "creators_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Phase 3: CreatorProspect — warming pipeline fields
ALTER TABLE "creator_prospects" ADD COLUMN IF NOT EXISTS "warming_comments" TEXT;
ALTER TABLE "creator_prospects" ADD COLUMN IF NOT EXISTS "warming_started_at" TIMESTAMP(3);
ALTER TABLE "creator_prospects" ADD COLUMN IF NOT EXISTS "comments_posted" INTEGER NOT NULL DEFAULT 0;
