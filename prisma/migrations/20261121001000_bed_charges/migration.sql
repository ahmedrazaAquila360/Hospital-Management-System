-- AlterTable
ALTER TABLE "Bed" ADD COLUMN     "nightlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BedStay" (
    "id" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "admissionId" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end" TIMESTAMP(3),
    "nightlyRate" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BedStay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BedStay_admissionId_start_idx" ON "BedStay"("admissionId", "start");

-- AddForeignKey
ALTER TABLE "BedStay" ADD CONSTRAINT "BedStay_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedStay" ADD CONSTRAINT "BedStay_admissionId_fkey" FOREIGN KEY ("admissionId") REFERENCES "Admission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX one_open_stay ON "BedStay" ("admissionId") WHERE "end" IS NULL;
INSERT INTO "BedStay" (id,"bedId","admissionId",start,"end","nightlyRate") SELECT 'stay-' || id,"bedId",id,"admittedAt","dischargedAt",0 FROM "Admission";
