-- AddColumn: revised_from_id on outfit_checks (self-referential FK)
ALTER TABLE "outfit_checks" ADD COLUMN "revised_from_id" TEXT;

ALTER TABLE "outfit_checks"
  ADD CONSTRAINT "outfit_checks_revised_from_id_fkey"
  FOREIGN KEY ("revised_from_id") REFERENCES "outfit_checks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "outfit_checks_revised_from_id_idx" ON "outfit_checks"("revised_from_id");
