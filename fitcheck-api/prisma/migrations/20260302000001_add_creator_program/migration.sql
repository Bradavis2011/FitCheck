-- CreateTable
CREATE TABLE "creators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'prospect',
    "tier" TEXT NOT NULL DEFAULT 'nano',
    "referral_code" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "contacted_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "last_post_date" TIMESTAMP(3),
    "total_views" INTEGER NOT NULL DEFAULT 0,
    "total_posts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creator_posts" (
    "id" TEXT NOT NULL,
    "creator_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "external_url" TEXT,
    "hook_used" TEXT,
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "is_viral" BOOLEAN NOT NULL DEFAULT false,
    "posted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "creator_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "creators_referral_code_key" ON "creators"("referral_code");

-- CreateIndex
CREATE INDEX "creators_status_idx" ON "creators"("status");

-- CreateIndex
CREATE INDEX "creator_posts_creator_id_idx" ON "creator_posts"("creator_id");

-- CreateIndex
CREATE INDEX "creator_posts_is_viral_idx" ON "creator_posts"("is_viral");

-- AddForeignKey
ALTER TABLE "creator_posts" ADD CONSTRAINT "creator_posts_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "creators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
