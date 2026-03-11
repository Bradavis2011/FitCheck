-- Migration: Add promptType to PromptVersion + helpful/promptVersion to StylistChat

-- Add promptType column to prompt_versions
ALTER TABLE "prompt_versions"
  ADD COLUMN IF NOT EXISTS "prompt_type" TEXT NOT NULL DEFAULT 'outfit_feedback';

CREATE INDEX IF NOT EXISTS "prompt_versions_prompt_type_idx"
  ON "prompt_versions" ("prompt_type");

-- Add helpful and prompt_version columns to stylist_chats
ALTER TABLE "stylist_chats"
  ADD COLUMN IF NOT EXISTS "helpful" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "prompt_version" TEXT;
