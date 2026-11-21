-- CreateTable
CREATE TABLE "Encounter" (
    "id" TEXT NOT NULL,
    "token" SERIAL NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "checkedInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "narrative" TEXT NOT NULL,
    "instructions" TEXT,
    "vitals" JSONB,
    "followUp" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_token_key" ON "Encounter"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Encounter_appointmentId_key" ON "Encounter"("appointmentId");

-- CreateIndex
CREATE INDEX "ClinicalNote_encounterId_createdAt_idx" ON "ClinicalNote"("encounterId", "createdAt");

-- AddForeignKey
ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Encounter" (id,"appointmentId","checkedInAt")
SELECT 'visit-' || id,id,"updatedAt" FROM "Appointment" WHERE status IN ('CHECKED_IN','IN_PROGRESS');
INSERT INTO "Permission" (id,key,label,module) VALUES
('opd-view','opd.view','View outpatient consultations','opd'),
('opd-edit','opd.edit','Document outpatient consultations','opd'),
('opd-manage','opd.manage','Access all outpatient consultations','opd');
INSERT INTO "RolePermission" (id,"roleId","permissionId")
SELECT md5(r.id || p.id),r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE p.module='opd' AND (r.name='ADMIN' OR (r.name='DENTIST' AND p.key IN ('opd.view','opd.edit')));
