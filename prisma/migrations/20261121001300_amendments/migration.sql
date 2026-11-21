-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdmissionState" ADD VALUE 'REQUESTED';
ALTER TYPE "AdmissionState" ADD VALUE 'ACTIVE';
ALTER TYPE "AdmissionState" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "ClinicalNote" ADD COLUMN     "amendmentReason" TEXT,
ADD COLUMN     "previousId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalNote_previousId_key" ON "ClinicalNote"("previousId");

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "ClinicalNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

