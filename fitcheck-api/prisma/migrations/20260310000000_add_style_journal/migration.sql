-- CreateTable
CREATE TABLE "style_articles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "article_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "input_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "style_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "style_articles_user_id_idx" ON "style_articles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "style_articles_user_id_article_type_key" ON "style_articles"("user_id", "article_type");

-- AddForeignKey
ALTER TABLE "style_articles" ADD CONSTRAINT "style_articles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
