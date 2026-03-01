-- AI Workforce Strategy: All schema additions for Tier 0–2

-- ─── Tier 0A: Email Compliance (CAN-SPAM / GDPR) ─────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "email_opt_out"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "unsubscribe_token"  TEXT UNIQUE;

-- ─── Tier 0D: Privacy/Terms Versioning ───────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "privacy_policy_version" TEXT,
  ADD COLUMN IF NOT EXISTS "tos_version"             TEXT,
  ADD COLUMN IF NOT EXISTS "tos_accepted_at"         TIMESTAMP;

-- ─── Tier 0B: Data Deletion Audit Log ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "data_deletion_logs" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"          TEXT        NOT NULL,
  "user_email"       TEXT        NOT NULL,
  "requested_at"     TIMESTAMP   NOT NULL DEFAULT NOW(),
  "status"           TEXT        NOT NULL DEFAULT 'pending',
  "steps_completed"  JSONB       NOT NULL DEFAULT '[]',
  "error"            TEXT,
  "completed_at"     TIMESTAMP,
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "data_deletion_logs_status_idx" ON "data_deletion_logs" ("status");

-- ─── Tier 1A: Support Tickets ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "support_tickets" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"       TEXT,
  "question"      TEXT        NOT NULL,
  "ai_response"   TEXT,
  "status"        TEXT        NOT NULL DEFAULT 'open',
  "escalated_at"  TIMESTAMP,
  "created_at"    TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updated_at"    TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "support_tickets_status_idx"   ON "support_tickets" ("status");
CREATE INDEX IF NOT EXISTS "support_tickets_user_id_idx"  ON "support_tickets" ("user_id");

-- ─── Tier 1B: Monthly Financials ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "monthly_financials" (
  "id"            TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "month"         TEXT        NOT NULL UNIQUE,
  "mrr"           DECIMAL     NOT NULL DEFAULT 0,
  "gemini_cost"   DECIMAL     NOT NULL DEFAULT 0,
  "hosting_cost"  DECIMAL     NOT NULL DEFAULT 0,
  "net_margin"    DECIMAL     NOT NULL DEFAULT 0,
  "notes"         TEXT,
  "created_at"    TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);

-- ─── Tier 2A: Churn Risk Scores ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "churn_risk_scores" (
  "id"             TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"        TEXT        NOT NULL UNIQUE,
  "risk_score"     DECIMAL     NOT NULL DEFAULT 0,
  "risk_factors"   JSONB       NOT NULL DEFAULT '[]',
  "action_taken"   TEXT,
  "action_taken_at" TIMESTAMP,
  "computed_at"    TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "churn_risk_scores_risk_score_idx" ON "churn_risk_scores" ("risk_score" DESC);

-- ─── Tier 2B: User Feedback ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "user_feedback" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"      TEXT,
  "type"         TEXT        NOT NULL DEFAULT 'general',
  "text"         TEXT        NOT NULL,
  "sentiment"    TEXT,
  "ai_category"  TEXT,
  "status"       TEXT        NOT NULL DEFAULT 'open',
  "created_at"   TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "user_feedback_status_idx" ON "user_feedback" ("status");

-- ─── Tier 2C: Blog Drafts (SEO Content) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS "blog_drafts" (
  "id"               TEXT        NOT NULL DEFAULT gen_random_uuid(),
  "title"            TEXT        NOT NULL,
  "slug"             TEXT        NOT NULL UNIQUE,
  "content"          TEXT        NOT NULL,
  "meta_description" TEXT,
  "og_title"         TEXT,
  "status"           TEXT        NOT NULL DEFAULT 'draft',
  "source_data"      JSONB,
  "created_at"       TIMESTAMP   NOT NULL DEFAULT NOW(),
  "updated_at"       TIMESTAMP   NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "blog_drafts_status_idx" ON "blog_drafts" ("status");
