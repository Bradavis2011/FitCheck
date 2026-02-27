-- Add missing indexes for common query patterns

-- Notification: filter by isRead status and by type
CREATE INDEX IF NOT EXISTS "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");
CREATE INDEX IF NOT EXISTS "notifications_type_created_at_idx" ON "notifications"("type", "created_at");

-- Report: filter by status for safety monitor
CREATE INDEX IF NOT EXISTS "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- StyleDNA: compound user+time query (analytics, RSI self-improvement)
CREATE INDEX IF NOT EXISTS "style_dna_user_id_created_at_idx" ON "style_dna"("user_id", "created_at");

-- EmailSequence: look up by userId (lifecycle email service)
CREATE INDEX IF NOT EXISTS "email_sequences_user_id_idx" ON "email_sequences"("user_id");

-- User: filter by tier (revenue/cost agent, growth dashboard)
CREATE INDEX IF NOT EXISTS "users_tier_idx" ON "users"("tier");
