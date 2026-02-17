-- CreateTable
CREATE TABLE "comparison_posts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "image_a_url" TEXT,
    "image_a_data" TEXT,
    "image_b_url" TEXT,
    "image_b_data" TEXT,
    "question" TEXT,
    "occasions" TEXT[],
    "votes_a" INTEGER NOT NULL DEFAULT 0,
    "votes_b" INTEGER NOT NULL DEFAULT 0,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comparison_votes" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "choice" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comparison_votes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comparison_posts_user_id_created_at_idx" ON "comparison_posts"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "comparison_posts_created_at_idx" ON "comparison_posts"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "comparison_votes_post_id_user_id_key" ON "comparison_votes"("post_id", "user_id");

-- CreateIndex
CREATE INDEX "comparison_votes_post_id_idx" ON "comparison_votes"("post_id");

-- CreateIndex
CREATE INDEX "comparison_votes_user_id_idx" ON "comparison_votes"("user_id");

-- AddForeignKey
ALTER TABLE "comparison_posts" ADD CONSTRAINT "comparison_posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_votes" ADD CONSTRAINT "comparison_votes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "comparison_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comparison_votes" ADD CONSTRAINT "comparison_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
