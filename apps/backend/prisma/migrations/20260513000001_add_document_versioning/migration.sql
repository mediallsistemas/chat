-- AlterTable
ALTER TABLE "documents" ADD COLUMN "version_of" TEXT,
                         ADD COLUMN "version_number" INTEGER NOT NULL DEFAULT 1,
                         ADD COLUMN "is_latest" BOOLEAN NOT NULL DEFAULT true;

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_version_of_fkey"
  FOREIGN KEY ("version_of") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "documents_version_of_idx" ON "documents"("version_of");
