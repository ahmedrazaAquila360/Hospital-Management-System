-- CreateTable
CREATE TABLE "Medication" (
    "id" TEXT NOT NULL,
    "generic" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "strength" TEXT NOT NULL,
    "form" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    CONSTRAINT "Medication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PharmacyBatch" (
    "id" TEXT NOT NULL,
    "medicationId" TEXT NOT NULL,
    "lot" TEXT NOT NULL,
    "expiry" DATE NOT NULL,
    "supplier" TEXT NOT NULL,
    "purchase" DECIMAL(10,2) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "PharmacyBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispensing" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dispensing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Medication_generic_brand_strength_form_key" ON "Medication"("generic", "brand", "strength", "form");

-- CreateIndex
CREATE INDEX "PharmacyBatch_expiry_idx" ON "PharmacyBatch"("expiry");

-- CreateIndex
CREATE UNIQUE INDEX "PharmacyBatch_medicationId_lot_key" ON "PharmacyBatch"("medicationId", "lot");

-- CreateIndex
CREATE UNIQUE INDEX "Dispensing_invoiceId_key" ON "Dispensing"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispensing_medicineId_key" ON "Dispensing"("medicineId");

-- AddForeignKey
ALTER TABLE "PharmacyBatch" ADD CONSTRAINT "PharmacyBatch_medicationId_fkey" FOREIGN KEY ("medicationId") REFERENCES "Medication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensing" ADD CONSTRAINT "Dispensing_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PharmacyBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensing" ADD CONSTRAINT "Dispensing_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "PrescriptionMedicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispensing" ADD CONSTRAINT "Dispensing_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PharmacyBatch" ADD CHECK (quantity >= 0 AND price >= 0 AND purchase >= 0);
ALTER TABLE "Dispensing" ADD CHECK (quantity > 0);
