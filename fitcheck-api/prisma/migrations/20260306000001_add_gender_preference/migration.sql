-- Add gender_preference to users
-- B-override for affiliate product gender filtering
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gender_preference" TEXT;
