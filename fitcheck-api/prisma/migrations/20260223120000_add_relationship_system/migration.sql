-- AlterTable: add event_date to outfit_checks
ALTER TABLE "outfit_checks" ADD COLUMN IF NOT EXISTS "event_date" TIMESTAMP(3);

-- CreateTable: event_follow_ups
CREATE TABLE IF NOT EXISTS "event_follow_ups" (
    "id" TEXT NOT NULL,
    "outfit_check_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "event_date" TIMESTAMP(3),
    "follow_up_at" TIMESTAMP(3) NOT NULL,
    "response" TEXT,
    "responded_at" TIMESTAMP(3),
    "push_sent_at" TIMESTAMP(3),
    "email_sent_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "event_follow_ups_follow_up_at_status_idx" ON "event_follow_ups"("follow_up_at", "status");
CREATE INDEX IF NOT EXISTS "event_follow_ups_user_id_status_idx" ON "event_follow_ups"("user_id", "status");

-- AddForeignKey
ALTER TABLE "event_follow_ups" ADD CONSTRAINT "event_follow_ups_outfit_check_id_fkey"
    FOREIGN KEY ("outfit_check_id") REFERENCES "outfit_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "event_follow_ups" ADD CONSTRAINT "event_follow_ups_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: style_narratives
CREATE TABLE IF NOT EXISTS "style_narratives" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "outfit_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_narratives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "style_narratives_user_id_period_key" ON "style_narratives"("user_id", "period");
CREATE INDEX IF NOT EXISTS "style_narratives_user_id_idx" ON "style_narratives"("user_id");

-- AddForeignKey
ALTER TABLE "style_narratives" ADD CONSTRAINT "style_narratives_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: milestone_messages
CREATE TABLE IF NOT EXISTS "milestone_messages" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "milestone_key" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "milestone_messages_user_id_milestone_key_key" ON "milestone_messages"("user_id", "milestone_key");
CREATE INDEX IF NOT EXISTS "milestone_messages_user_id_idx" ON "milestone_messages"("user_id");

-- AddForeignKey
ALTER TABLE "milestone_messages" ADD CONSTRAINT "milestone_messages_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
