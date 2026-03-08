-- CreateTable
CREATE TABLE "wardrobe_prescriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_period" TEXT NOT NULL,
    "gaps" JSONB NOT NULL DEFAULT '[]',
    "total_items" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wardrobe_prescriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wardrobe_prescriptions_user_id_week_period_key" ON "wardrobe_prescriptions"("user_id", "week_period");

-- CreateIndex
CREATE INDEX "wardrobe_prescriptions_user_id_created_at_idx" ON "wardrobe_prescriptions"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "wardrobe_prescriptions" ADD CONSTRAINT "wardrobe_prescriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
