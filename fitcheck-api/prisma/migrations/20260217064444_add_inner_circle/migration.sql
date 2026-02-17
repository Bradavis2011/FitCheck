-- CreateTable
CREATE TABLE "inner_circle_members" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inner_circle_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inner_circle_members_user_id_idx" ON "inner_circle_members"("user_id");

-- CreateIndex
CREATE INDEX "inner_circle_members_member_id_idx" ON "inner_circle_members"("member_id");

-- CreateIndex
CREATE UNIQUE INDEX "inner_circle_members_user_id_member_id_key" ON "inner_circle_members"("user_id", "member_id");

-- AddForeignKey
ALTER TABLE "inner_circle_members" ADD CONSTRAINT "inner_circle_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inner_circle_members" ADD CONSTRAINT "inner_circle_members_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
