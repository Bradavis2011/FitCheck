-- CreateTable
CREATE TABLE "waitlist_entries" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "referral_code" TEXT NOT NULL,
    "referred_by" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_email_key" ON "waitlist_entries"("email");

-- CreateIndex
CREATE UNIQUE INDEX "waitlist_entries_referral_code_key" ON "waitlist_entries"("referral_code");

-- CreateIndex
CREATE INDEX "waitlist_entries_created_at_idx" ON "waitlist_entries"("created_at");
