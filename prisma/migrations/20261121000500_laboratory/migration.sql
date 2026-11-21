-- CreateEnum
CREATE TYPE "LabStatus" AS ENUM ('ORDERED', 'SAMPLE_PENDING', 'SAMPLE_COLLECTED', 'PROCESSING', 'COMPLETED', 'VERIFIED', 'RELEASED', 'CANCELLED');

-- CreateTable
CREATE TABLE "LabTest" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "referenceRange" TEXT,

    CONSTRAINT "LabTest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabOrder" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "referenceRange" TEXT,
    "status" "LabStatus" NOT NULL DEFAULT 'ORDERED',
    "sampleId" TEXT,
    "collectedAt" TIMESTAMP(3),
    "result" TEXT,
    "abnormal" BOOLEAN,
    "enteredBy" TEXT,
    "verifiedBy" TEXT,
    "releasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabTest_name_key" ON "LabTest"("name");

-- CreateIndex
CREATE UNIQUE INDEX "LabOrder_sampleId_key" ON "LabOrder"("sampleId");

-- CreateIndex
CREATE INDEX "LabOrder_status_createdAt_idx" ON "LabOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LabOrder_encounterId_idx" ON "LabOrder"("encounterId");

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabOrder" ADD CONSTRAINT "LabOrder_testId_fkey" FOREIGN KEY ("testId") REFERENCES "LabTest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

