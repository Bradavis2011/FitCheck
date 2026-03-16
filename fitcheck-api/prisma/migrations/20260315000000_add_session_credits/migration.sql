-- Add micro-monetization fields to users table
-- session_expires_at: when set and in the future, user bypasses daily check limit
-- credits_remaining:  consumable check credits (purchased in packs)

ALTER TABLE "users" ADD COLUMN "session_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "credits_remaining" INTEGER NOT NULL DEFAULT 0;
