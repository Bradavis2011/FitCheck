-- Migration: 20260305000000_add_growth_intern
-- Adds CreatorProspect and RedditThread tables for the Growth Intern agent system

CREATE TABLE "creator_prospects" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT,
    "follower_range" TEXT,
    "niche" TEXT,
    "profile_url" TEXT,
    "content_style" TEXT,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "personalized_dm" TEXT,
    "follow_up_dm" TEXT,
    "email_subject" TEXT,
    "email_body" TEXT,
    "follow_up_email_body" TEXT,
    "outreach_method" TEXT,
    "notes" TEXT,
    "search_query" TEXT,
    "batch_date" TEXT,
    "contacted_at" TIMESTAMP(3),
    "followed_up_at" TIMESTAMP(3),
    "responded_at" TIMESTAMP(3),
    "email_opened_at" TIMESTAMP(3),
    "email_clicked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_prospects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "reddit_threads" (
    "id" TEXT NOT NULL,
    "subreddit" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "author_name" TEXT,
    "self_text" TEXT,
    "upvotes" INTEGER NOT NULL DEFAULT 0,
    "comment_count" INTEGER NOT NULL DEFAULT 0,
    "relevance_score" DOUBLE PRECISION,
    "category" TEXT,
    "suggested_response" TEXT,
    "status" TEXT NOT NULL DEFAULT 'identified',
    "reddit_comment_id" TEXT,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reddit_threads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "creator_prospects_platform_handle_key" ON "creator_prospects"("platform", "handle");
CREATE INDEX "creator_prospects_status_outreach_method_idx" ON "creator_prospects"("status", "outreach_method");

CREATE UNIQUE INDEX "reddit_threads_thread_id_key" ON "reddit_threads"("thread_id");
CREATE INDEX "reddit_threads_status_idx" ON "reddit_threads"("status");
