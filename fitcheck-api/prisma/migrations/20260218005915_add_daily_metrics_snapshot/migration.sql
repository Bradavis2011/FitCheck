-- CreateTable
CREATE TABLE "daily_metrics_snapshots" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "total_users" INTEGER NOT NULL,
    "new_users_today" INTEGER NOT NULL,
    "free_users" INTEGER NOT NULL,
    "plus_users" INTEGER NOT NULL,
    "pro_users" INTEGER NOT NULL,
    "dau" INTEGER NOT NULL,
    "wau" INTEGER NOT NULL,
    "checks_today" INTEGER NOT NULL,
    "feedbacks_today" INTEGER NOT NULL,
    "avg_ai_score" DOUBLE PRECISION,
    "users_with_streak" INTEGER NOT NULL,
    "avg_streak" DOUBLE PRECISION,
    "new_subscriptions" INTEGER NOT NULL DEFAULT 0,
    "cancellations" INTEGER NOT NULL DEFAULT 0,
    "renewals" INTEGER NOT NULL DEFAULT 0,
    "comparison_posts" INTEGER NOT NULL DEFAULT 0,
    "live_sessions" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_metrics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_snapshots_date_key" ON "daily_metrics_snapshots"("date");
