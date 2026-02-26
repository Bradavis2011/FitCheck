-- Migration: RSI Learning System — Phase A+B+C additions

-- A1: Push timing personalization — store modal check hour per user
ALTER TABLE "users" ADD COLUMN "preferred_nudge_hour" INTEGER;

-- B4: Comparison tool learning — track AI verdict on comparison analysis
ALTER TABLE "comparison_posts" ADD COLUMN "ai_verdict" TEXT;

-- C1: StyleDNA cohort clustering — tag prompt versions with their target cohort
ALTER TABLE "prompt_versions" ADD COLUMN "cohort" TEXT;
CREATE INDEX "prompt_versions_cohort_idx" ON "prompt_versions"("cohort");
