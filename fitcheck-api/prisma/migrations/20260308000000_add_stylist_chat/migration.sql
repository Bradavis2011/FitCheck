-- CreateTable
CREATE TABLE "stylist_chats" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stylist_chats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stylist_chats_user_id_created_at_idx" ON "stylist_chats"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "stylist_chats" ADD CONSTRAINT "stylist_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
