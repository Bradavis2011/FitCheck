-- CreateTable: DiscoveredRule
CREATE TABLE "discovered_rules" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sample_size" INTEGER NOT NULL,
    "evidence" JSONB,
    "incorporated" BOOLEAN NOT NULL DEFAULT false,
    "incorporated_in" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discovered_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PromptVersion
CREATE TABLE "prompt_versions" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "parent_version" TEXT,
    "prompt_text" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "traffic_pct" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_candidate" BOOLEAN NOT NULL DEFAULT false,
    "sample_size" INTEGER NOT NULL DEFAULT 0,
    "avg_ai_score" DOUBLE PRECISION,
    "avg_user_rating" DOUBLE PRECISION,
    "avg_community_delta" DOUBLE PRECISION,
    "helpful_pct" DOUBLE PRECISION,
    "promoted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ImprovementCycle
CREATE TABLE "improvement_cycles" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "log" TEXT,
    "trigger_metrics" JSONB,
    "weaknesses_found" JSONB,
    "knowledge_extracted" JSONB,
    "source_version" TEXT,
    "candidate_version" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "improvement_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "discovered_rules_category_idx" ON "discovered_rules"("category");

-- CreateIndex
CREATE INDEX "discovered_rules_incorporated_idx" ON "discovered_rules"("incorporated");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_version_key" ON "prompt_versions"("version");

-- CreateIndex
CREATE INDEX "prompt_versions_is_active_traffic_pct_idx" ON "prompt_versions"("is_active", "traffic_pct");

-- CreateIndex
CREATE INDEX "prompt_versions_parent_version_idx" ON "prompt_versions"("parent_version");

-- CreateIndex
CREATE INDEX "improvement_cycles_status_started_at_idx" ON "improvement_cycles"("status", "started_at");
