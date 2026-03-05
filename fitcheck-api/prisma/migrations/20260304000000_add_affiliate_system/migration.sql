-- CreateTable: AffiliateImpression
-- Tracks product recommendation impressions and clicks for affiliate attribution

CREATE TABLE IF NOT EXISTS "affiliate_impressions" (
    "id"              TEXT NOT NULL,
    "user_id"         TEXT NOT NULL,
    "outfit_check_id" TEXT,
    "placement"       TEXT NOT NULL,
    "archetype"       TEXT,
    "cohort"          TEXT,
    "score"           DOUBLE PRECISION,
    "product_ids"     TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clicked_id"      TEXT,
    "clicked_at"      TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_impressions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "affiliate_impressions"
    ADD CONSTRAINT "affiliate_impressions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey (nullable — outfit may be deleted)
ALTER TABLE "affiliate_impressions"
    ADD CONSTRAINT "affiliate_impressions_outfit_check_id_fkey"
    FOREIGN KEY ("outfit_check_id") REFERENCES "outfit_checks"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "affiliate_impressions_user_id_idx"
    ON "affiliate_impressions"("user_id");

CREATE INDEX IF NOT EXISTS "affiliate_impressions_placement_created_at_idx"
    ON "affiliate_impressions"("placement", "created_at");

CREATE INDEX IF NOT EXISTS "affiliate_impressions_created_at_idx"
    ON "affiliate_impressions"("created_at");
