-- Migration: Add Ops Learning Loop models
-- Adds 4 new models + 2 fields on ConversionSignal for the measurement/learning infrastructure

-- ConversionSignal: add outcome tracking fields
ALTER TABLE "conversion_signals" ADD COLUMN "converted_at" TIMESTAMP(3);
ALTER TABLE "conversion_signals" ADD COLUMN "outcome" TEXT;

-- EmailTemplateVariant
CREATE TABLE "email_template_variants" (
    "id"          TEXT NOT NULL,
    "sequence"    TEXT NOT NULL,
    "step"        INTEGER NOT NULL,
    "field"       TEXT NOT NULL,
    "variant"     TEXT NOT NULL,
    "isControl"   BOOLEAN NOT NULL DEFAULT false,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "opens"       INTEGER NOT NULL DEFAULT 0,
    "clicks"      INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "is_winner"   BOOLEAN,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_template_variants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "email_template_variants_sequence_step_field_isControl_key"
    ON "email_template_variants"("sequence", "step", "field", "isControl");

-- NudgeVariant
CREATE TABLE "nudge_variants" (
    "id"          TEXT NOT NULL,
    "segment"     TEXT NOT NULL,
    "title"       TEXT NOT NULL,
    "body"        TEXT NOT NULL,
    "isControl"   BOOLEAN NOT NULL DEFAULT false,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "isActive"    BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nudge_variants_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "nudge_variants_segment_isActive_idx" ON "nudge_variants"("segment", "isActive");

-- SocialPromptVariant
CREATE TABLE "social_prompt_variants" (
    "id"             TEXT NOT NULL,
    "content_type"   TEXT NOT NULL,
    "prompt_text"    TEXT NOT NULL,
    "parent_prompt"  TEXT,
    "avg_engagement" DOUBLE PRECISION,
    "sampleSize"     INTEGER NOT NULL DEFAULT 0,
    "isActive"       BOOLEAN NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_prompt_variants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "social_prompt_variants_content_type_key" ON "social_prompt_variants"("content_type");

-- ConversionCalibration
CREATE TABLE "conversion_calibrations" (
    "id"               TEXT NOT NULL,
    "signal_type"      TEXT NOT NULL,
    "strength"         DOUBLE PRECISION NOT NULL,
    "conversion_rate"  DOUBLE PRECISION NOT NULL,
    "sample_size"      INTEGER NOT NULL DEFAULT 0,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversion_calibrations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "conversion_calibrations_signal_type_isActive_idx"
    ON "conversion_calibrations"("signal_type", "isActive");
