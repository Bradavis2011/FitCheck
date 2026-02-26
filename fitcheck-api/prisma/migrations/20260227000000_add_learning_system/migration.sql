-- Add fields to outfit_checks
ALTER TABLE "outfit_checks" ADD COLUMN IF NOT EXISTS "judge_scores" JSONB;
ALTER TABLE "outfit_checks" ADD COLUMN IF NOT EXISTS "judge_evaluated" BOOLEAN NOT NULL DEFAULT false;

-- IntelligenceBusEntry
CREATE TABLE IF NOT EXISTS "intelligence_bus_entries" (
    "id" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "consumed_by" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "intelligence_bus_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "intelligence_bus_entries_entry_type_created_at_idx" ON "intelligence_bus_entries"("entry_type", "created_at");
CREATE INDEX IF NOT EXISTS "intelligence_bus_entries_expires_at_idx" ON "intelligence_bus_entries"("expires_at");

-- PromptSection
CREATE TABLE IF NOT EXISTS "prompt_sections" (
    "id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "content" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "parent_version" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "arena_win_rate" DOUBLE PRECISION,
    "changelog" TEXT,
    "failed_attempts" JSONB DEFAULT '[]',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "prompt_sections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "prompt_sections_section_key_version_key" ON "prompt_sections"("section_key", "version");
CREATE INDEX IF NOT EXISTS "prompt_sections_section_key_is_active_idx" ON "prompt_sections"("section_key", "is_active");

-- LearningMemory
CREATE TABLE IF NOT EXISTS "learning_memory" (
    "id" TEXT NOT NULL,
    "compiled_text" TEXT NOT NULL,
    "bullet_count" INTEGER NOT NULL DEFAULT 0,
    "source_entries" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "learning_memory_pkey" PRIMARY KEY ("id")
);

-- CritiqueReport
CREATE TABLE IF NOT EXISTS "critique_reports" (
    "id" TEXT NOT NULL,
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "section_mappings" JSONB NOT NULL DEFAULT '{}',
    "severity_scores" JSONB NOT NULL DEFAULT '{}',
    "addressed" BOOLEAN NOT NULL DEFAULT false,
    "piggyback_period" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "critique_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "critique_reports_addressed_created_at_idx" ON "critique_reports"("addressed", "created_at");

-- ArenaSession
CREATE TABLE IF NOT EXISTS "arena_sessions" (
    "id" TEXT NOT NULL,
    "challenger_section_key" TEXT NOT NULL,
    "challenger_version" INTEGER NOT NULL,
    "baseline_version" INTEGER NOT NULL,
    "trigger" TEXT NOT NULL DEFAULT 'surgeon',
    "status" TEXT NOT NULL DEFAULT 'running',
    "win_rate" DOUBLE PRECISION,
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "regression_passed" BOOLEAN,
    "deployed" BOOLEAN NOT NULL DEFAULT false,
    "result_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arena_sessions_pkey" PRIMARY KEY ("id")
);

-- ArenaMatch
CREATE TABLE IF NOT EXISTS "arena_matches" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "scenario_type" TEXT NOT NULL DEFAULT 'synthetic',
    "context_snapshot" JSONB NOT NULL,
    "baseline_response" TEXT NOT NULL,
    "challenger_response" TEXT NOT NULL,
    "winner" TEXT NOT NULL,
    "score_delta" JSONB,
    "judge_rationale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "arena_matches_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "arena_matches_session_id_idx" ON "arena_matches"("session_id");
ALTER TABLE "arena_matches" ADD CONSTRAINT "arena_matches_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "arena_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RegressionCase
CREATE TABLE IF NOT EXISTS "regression_cases" (
    "id" TEXT NOT NULL,
    "scenario_name" TEXT NOT NULL,
    "context_snapshot" JSONB NOT NULL,
    "baseline_scores" JSONB NOT NULL,
    "category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "regression_cases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "regression_cases_scenario_name_key" ON "regression_cases"("scenario_name");

-- JudgeCalibration
CREATE TABLE IF NOT EXISTS "judge_calibrations" (
    "id" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "bias_offset" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "last_calibrated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "judge_calibrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "judge_calibrations_dimension_key" ON "judge_calibrations"("dimension");

-- DailyTokenUsage
CREATE TABLE IF NOT EXISTS "daily_token_usage" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "user_tokens" INTEGER NOT NULL DEFAULT 0,
    "learning_tokens" INTEGER NOT NULL DEFAULT 0,
    "reserved_tokens" INTEGER NOT NULL DEFAULT 0,
    "budget" INTEGER NOT NULL,
    "learning_budget" INTEGER NOT NULL,
    "breakdown" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "daily_token_usage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "daily_token_usage_date_key" ON "daily_token_usage"("date");
