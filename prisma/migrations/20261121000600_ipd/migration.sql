-- CreateEnum
CREATE TYPE "BedState" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AdmissionState" AS ENUM ('ADMITTED', 'TRANSFERRED', 'DISCHARGE_REQUESTED', 'DISCHARGED');

-- CreateTable
CREATE TABLE "Bed" (
    "id" TEXT NOT NULL,
    "ward" TEXT NOT NULL,
    "room" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "BedState" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "Bed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Admission" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "admittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dischargedAt" TIMESTAMP(3),
    "summary" TEXT,
    "status" "AdmissionState" NOT NULL DEFAULT 'ADMITTED',

    CONSTRAINT "Admission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bed_ward_room_label_key" ON "Bed"("ward", "room", "label");

-- CreateIndex
CREATE UNIQUE INDEX "Admission_number_key" ON "Admission"("number");

-- CreateIndex
CREATE INDEX "Admission_patientId_admittedAt_idx" ON "Admission"("patientId", "admittedAt");

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Admission" ADD CONSTRAINT "Admission_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "Bed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX one_current_bed ON "Admission" ("bedId") WHERE "dischargedAt" IS NULL;
CREATE UNIQUE INDEX one_current_admission ON "Admission" ("patientId") WHERE "dischargedAt" IS NULL;
