-- AlterTable
ALTER TABLE "outfit_checks" ADD COLUMN     "blur_face" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "expires_at" TIMESTAMP(3),
ADD COLUMN     "visibility" TEXT NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE "user_stats" ADD COLUMN     "badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "daily_feedback_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "daily_goals_reset_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "daily_helpful_votes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "last_active_date" DATE,
ADD COLUMN     "last_monthly_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "last_weekly_reset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "monthly_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "streak_freeze_used" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "weekly_points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "xp_to_next_level" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "privacy_settings" JSONB DEFAULT '{"blurFaceDefault":true,"visibility":"all","autoDelete":"never"}';

-- CreateIndex
CREATE INDEX "user_stats_weekly_points_idx" ON "user_stats"("weekly_points" DESC);

-- CreateIndex
CREATE INDEX "user_stats_monthly_points_idx" ON "user_stats"("monthly_points" DESC);

-- CreateIndex
CREATE INDEX "user_stats_points_idx" ON "user_stats"("points" DESC);
