-- CreateTable
CREATE TABLE "stylists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "bio" TEXT,
    "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "instagram_url" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stylists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expert_reviews" (
    "id" TEXT NOT NULL,
    "outfit_check_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stylist_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "score" INTEGER,
    "feedback" TEXT,
    "completed_at" TIMESTAMP(3),
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "dress_code" TEXT,
    "type" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "compare_result" JSONB,
    "compare_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_outfits" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "outfit_check_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_outfits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wardrobe_items" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "image_url" TEXT,
    "times_worn" INTEGER NOT NULL DEFAULT 0,
    "last_worn" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wardrobe_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenges" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "theme" TEXT NOT NULL,
    "prize" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_submissions" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "outfit_check_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "challenge_votes" (
    "id" TEXT NOT NULL,
    "submission_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "challenge_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stylists_user_id_key" ON "stylists"("user_id");

-- CreateIndex
CREATE INDEX "expert_reviews_user_id_requested_at_idx" ON "expert_reviews"("user_id", "requested_at");

-- CreateIndex
CREATE INDEX "expert_reviews_stylist_id_status_idx" ON "expert_reviews"("stylist_id", "status");

-- CreateIndex
CREATE INDEX "expert_reviews_outfit_check_id_idx" ON "expert_reviews"("outfit_check_id");

-- CreateIndex
CREATE INDEX "events_user_id_date_idx" ON "events"("user_id", "date");

-- CreateIndex
CREATE INDEX "events_user_id_status_idx" ON "events"("user_id", "status");

-- CreateIndex
CREATE INDEX "event_outfits_event_id_idx" ON "event_outfits"("event_id");

-- CreateIndex
CREATE INDEX "event_outfits_user_id_idx" ON "event_outfits"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_outfits_event_id_outfit_check_id_key" ON "event_outfits"("event_id", "outfit_check_id");

-- CreateIndex
CREATE INDEX "wardrobe_items_user_id_category_idx" ON "wardrobe_items"("user_id", "category");

-- CreateIndex
CREATE INDEX "wardrobe_items_user_id_times_worn_idx" ON "wardrobe_items"("user_id", "times_worn" DESC);

-- CreateIndex
CREATE INDEX "challenges_status_starts_at_idx" ON "challenges"("status", "starts_at");

-- CreateIndex
CREATE INDEX "challenges_status_ends_at_idx" ON "challenges"("status", "ends_at");

-- CreateIndex
CREATE INDEX "challenge_submissions_challenge_id_votes_idx" ON "challenge_submissions"("challenge_id", "votes" DESC);

-- CreateIndex
CREATE INDEX "challenge_submissions_user_id_idx" ON "challenge_submissions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_submissions_challenge_id_user_id_key" ON "challenge_submissions"("challenge_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_submissions_challenge_id_outfit_check_id_key" ON "challenge_submissions"("challenge_id", "outfit_check_id");

-- CreateIndex
CREATE INDEX "challenge_votes_submission_id_idx" ON "challenge_votes"("submission_id");

-- CreateIndex
CREATE INDEX "challenge_votes_user_id_idx" ON "challenge_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenge_votes_submission_id_user_id_key" ON "challenge_votes"("submission_id", "user_id");

-- AddForeignKey
ALTER TABLE "stylists" ADD CONSTRAINT "stylists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_outfit_check_id_fkey" FOREIGN KEY ("outfit_check_id") REFERENCES "outfit_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_reviews" ADD CONSTRAINT "expert_reviews_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "stylists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_outfits" ADD CONSTRAINT "event_outfits_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_outfits" ADD CONSTRAINT "event_outfits_outfit_check_id_fkey" FOREIGN KEY ("outfit_check_id") REFERENCES "outfit_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_outfits" ADD CONSTRAINT "event_outfits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wardrobe_items" ADD CONSTRAINT "wardrobe_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_outfit_check_id_fkey" FOREIGN KEY ("outfit_check_id") REFERENCES "outfit_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_submissions" ADD CONSTRAINT "challenge_submissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "challenge_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "challenge_votes" ADD CONSTRAINT "challenge_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
