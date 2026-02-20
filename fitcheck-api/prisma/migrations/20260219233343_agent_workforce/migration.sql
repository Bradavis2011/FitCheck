-- AlterTable
ALTER TABLE "outfit_checks" ADD COLUMN     "prompt_version" TEXT;

-- CreateTable
CREATE TABLE "fashion_trends" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'global',
    "seasonal_colors" TEXT[],
    "trending_styles" TEXT[],
    "key_pieces" TEXT[],
    "trending_patterns" TEXT[],
    "fading_trends" TEXT[],
    "raw_analysis" JSONB,
    "platform_trends" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fashion_trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "risk_level" TEXT NOT NULL DEFAULT 'low',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL,
    "result" JSONB,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "executed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_configs" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "max_actions_per_day" INTEGER NOT NULL DEFAULT 50,
    "max_actions_per_hour" INTEGER NOT NULL DEFAULT 10,
    "auto_approve_risk" TEXT NOT NULL DEFAULT 'medium',
    "config" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "last_error" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_sequences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_send_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "email_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sequence" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversion_signals" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "signal_type" TEXT NOT NULL,
    "strength" DOUBLE PRECISION NOT NULL,
    "acted_on" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "media_url" TEXT,
    "hashtags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_for" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "external_id" TEXT,
    "engagement" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_reviews" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT,
    "body" TEXT,
    "author" TEXT,
    "draft_reply" TEXT,
    "reply_status" TEXT NOT NULL DEFAULT 'pending',
    "posted_at" TIMESTAMP(3),
    "review_date" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fashion_trends_period_key" ON "fashion_trends"("period");

-- CreateIndex
CREATE INDEX "agent_actions_agent_status_idx" ON "agent_actions"("agent", "status");

-- CreateIndex
CREATE INDEX "agent_actions_status_created_at_idx" ON "agent_actions"("status", "created_at");

-- CreateIndex
CREATE INDEX "agent_actions_risk_level_status_idx" ON "agent_actions"("risk_level", "status");

-- CreateIndex
CREATE UNIQUE INDEX "agent_configs_agent_key" ON "agent_configs"("agent");

-- CreateIndex
CREATE INDEX "email_sequences_status_next_send_at_idx" ON "email_sequences"("status", "next_send_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_sequences_user_id_sequence_key" ON "email_sequences"("user_id", "sequence");

-- CreateIndex
CREATE INDEX "email_events_user_id_sequence_idx" ON "email_events"("user_id", "sequence");

-- CreateIndex
CREATE INDEX "conversion_signals_user_id_acted_on_idx" ON "conversion_signals"("user_id", "acted_on");

-- CreateIndex
CREATE INDEX "conversion_signals_signal_type_created_at_idx" ON "conversion_signals"("signal_type", "created_at");

-- CreateIndex
CREATE INDEX "social_posts_status_scheduled_for_idx" ON "social_posts"("status", "scheduled_for");

-- CreateIndex
CREATE UNIQUE INDEX "app_reviews_external_id_key" ON "app_reviews"("external_id");

-- CreateIndex
CREATE INDEX "app_reviews_store_reply_status_idx" ON "app_reviews"("store", "reply_status");

-- CreateIndex
CREATE INDEX "app_reviews_rating_created_at_idx" ON "app_reviews"("rating", "created_at");
