-- AlterTable: add source and normalizedName to wardrobe_items
ALTER TABLE "wardrobe_items" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE "wardrobe_items" ADD COLUMN IF NOT EXISTS "normalized_name" TEXT;

-- CreateTable: wardrobe_item_outfits (join table)
CREATE TABLE IF NOT EXISTS "wardrobe_item_outfits" (
    "id" TEXT NOT NULL,
    "wardrobe_item_id" TEXT NOT NULL,
    "outfit_check_id" TEXT NOT NULL,
    "detected_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wardrobe_item_outfits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "wardrobe_item_outfits_wardrobe_item_id_idx" ON "wardrobe_item_outfits"("wardrobe_item_id");
CREATE INDEX IF NOT EXISTS "wardrobe_item_outfits_outfit_check_id_idx" ON "wardrobe_item_outfits"("outfit_check_id");
CREATE UNIQUE INDEX IF NOT EXISTS "wardrobe_item_outfits_wardrobe_item_id_outfit_check_id_key" ON "wardrobe_item_outfits"("wardrobe_item_id", "outfit_check_id");

-- CreateIndex on wardrobe_items
CREATE INDEX IF NOT EXISTS "wardrobe_items_user_id_normalized_name_idx" ON "wardrobe_items"("user_id", "normalized_name");

-- AddForeignKey
ALTER TABLE "wardrobe_item_outfits" ADD CONSTRAINT "wardrobe_item_outfits_wardrobe_item_id_fkey"
    FOREIGN KEY ("wardrobe_item_id") REFERENCES "wardrobe_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "wardrobe_item_outfits" ADD CONSTRAINT "wardrobe_item_outfits_outfit_check_id_fkey"
    FOREIGN KEY ("outfit_check_id") REFERENCES "outfit_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
