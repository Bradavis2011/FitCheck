-- AlterTable: Add contentType and sourceData to social_posts
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "content_type" TEXT;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "source_data" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "social_posts_content_type_created_at_idx" ON "social_posts"("content_type", "created_at");
