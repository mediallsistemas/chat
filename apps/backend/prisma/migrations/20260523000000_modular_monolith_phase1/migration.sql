-- DropForeignKey
ALTER TABLE "groups" DROP CONSTRAINT "groups_unit_id_fkey";

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

