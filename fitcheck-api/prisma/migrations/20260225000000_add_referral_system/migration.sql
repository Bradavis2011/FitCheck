-- Add referral system fields to users table

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "referral_code" TEXT,
  ADD COLUMN IF NOT EXISTS "referred_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "bonus_daily_checks" INTEGER NOT NULL DEFAULT 0;

-- Unique index for referral codes
CREATE UNIQUE INDEX IF NOT EXISTS "users_referral_code_key" ON "users"("referral_code");

-- Foreign key: referred_by_id → users.id (SET NULL on delete so referrer deletion doesn't break referred users)
ALTER TABLE "users"
  ADD CONSTRAINT "users_referred_by_id_fkey"
  FOREIGN KEY ("referred_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
