-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "encounterId" TEXT;

-- AlterTable
ALTER TABLE "Encounter" ADD COLUMN     "admissionId" TEXT,
ALTER COLUMN "appointmentId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_admissionId_key" ON "Encounter"("admissionId");

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Encounter" ADD CHECK (num_nonnulls("appointmentId","admissionId") = 1);
INSERT INTO "Encounter" (id,"admissionId","checkedInAt") SELECT 'ipd-' || id,id,"admittedAt" FROM "Admission";
