-- CreateIndex: outfit_checks (P1 performance indexes)
CREATE INDEX IF NOT EXISTS "outfit_checks_user_id_created_at_idx" ON "outfit_checks"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "outfit_checks_user_id_is_deleted_idx" ON "outfit_checks"("user_id", "is_deleted");
CREATE INDEX IF NOT EXISTS "outfit_checks_is_public_created_at_idx" ON "outfit_checks"("is_public", "created_at");

-- CreateIndex: follow_ups (P1 performance index)
CREATE INDEX IF NOT EXISTS "follow_ups_outfit_check_id_idx" ON "follow_ups"("outfit_check_id");

-- Fix Report reporter FK: RESTRICT → CASCADE
ALTER TABLE "reports" DROP CONSTRAINT IF EXISTS "reports_reporter_id_fkey";
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_fkey"
    FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
