-- All historical operational rows start in the original main branch.
CREATE OR REPLACE FUNCTION hospital_current_branch() RETURNS text LANGUAGE sql STABLE AS $$
 SELECT COALESCE(NULLIF(current_setting('hospital.branch_id', true), ''), 'branch-main')
$$;
INSERT INTO "ClinicSettings" (id, "clinicName", "updatedAt")
SELECT 'hospital-main', 'General Hospital', now() WHERE NOT EXISTS (SELECT 1 FROM "ClinicSettings");
INSERT INTO "Branch" (id, "hospitalId", name)
SELECT 'branch-main', id, 'Main branch' FROM "ClinicSettings" ORDER BY id LIMIT 1;
CREATE TABLE "BranchMembership" (
 "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
 "branchId" text NOT NULL REFERENCES "Branch"(id) ON DELETE RESTRICT,
 PRIMARY KEY ("userId", "branchId")
);
CREATE TABLE "PatientBranch" (
 "patientId" text NOT NULL REFERENCES "Patient"(id) ON DELETE RESTRICT,
 "branchId" text NOT NULL REFERENCES "Branch"(id) ON DELETE RESTRICT,
 PRIMARY KEY ("patientId", "branchId")
);
INSERT INTO "BranchMembership" SELECT id, 'branch-main' FROM "User";
INSERT INTO "PatientBranch" SELECT id, 'branch-main' FROM "Patient";
ALTER TABLE "Session" ADD COLUMN "activeBranchId" text NOT NULL DEFAULT 'branch-main' REFERENCES "Branch"(id);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='hospital_branch_runtime') THEN
  CREATE ROLE hospital_branch_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
END $$;
GRANT USAGE ON SCHEMA public TO hospital_branch_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hospital_branch_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hospital_branch_runtime;
ALTER TABLE "Department" ALTER COLUMN "branchId" SET DEFAULT hospital_current_branch();
UPDATE "Department" SET "branchId"='branch-main' WHERE "branchId" IS NULL;
ALTER TABLE "Department" ALTER COLUMN "branchId" SET NOT NULL;
CREATE INDEX "Department_branchId_idx" ON "Department"("branchId");
ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Department" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Appointment" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Appointment_branchId_idx" ON "Appointment"("branchId");
ALTER TABLE "Appointment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Appointment" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "AppointmentRequest" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "AppointmentRequest_branchId_idx" ON "AppointmentRequest"("branchId");
ALTER TABLE "AppointmentRequest" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "AppointmentRequest" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Treatment" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Treatment_branchId_idx" ON "Treatment"("branchId");
ALTER TABLE "Treatment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Treatment" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "TreatmentTooth" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "TreatmentTooth_branchId_idx" ON "TreatmentTooth"("branchId");
ALTER TABLE "TreatmentTooth" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "TreatmentTooth" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Prescription" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Prescription_branchId_idx" ON "Prescription"("branchId");
ALTER TABLE "Prescription" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Prescription" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "PrescriptionMedicine" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "PrescriptionMedicine_branchId_idx" ON "PrescriptionMedicine"("branchId");
ALTER TABLE "PrescriptionMedicine" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "PrescriptionMedicine" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Invoice" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Invoice_branchId_idx" ON "Invoice"("branchId");
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Invoice" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "InvoiceItem" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "InvoiceItem_branchId_idx" ON "InvoiceItem"("branchId");
ALTER TABLE "InvoiceItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "InvoiceItem" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Payment" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Payment_branchId_idx" ON "Payment"("branchId");
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Payment" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Expense" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Expense_branchId_idx" ON "Expense"("branchId");
ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Expense" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Document" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Document_branchId_idx" ON "Document"("branchId");
ALTER TABLE "Document" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Document" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Notification" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Notification_branchId_idx" ON "Notification"("branchId");
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Notification" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "ActivityLog" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "ActivityLog_branchId_idx" ON "ActivityLog"("branchId");
ALTER TABLE "ActivityLog" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "ActivityLog" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Encounter" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Encounter_branchId_idx" ON "Encounter"("branchId");
ALTER TABLE "Encounter" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Encounter" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "ClinicalNote" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "ClinicalNote_branchId_idx" ON "ClinicalNote"("branchId");
ALTER TABLE "ClinicalNote" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "ClinicalNote" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "LabOrder" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "LabOrder_branchId_idx" ON "LabOrder"("branchId");
ALTER TABLE "LabOrder" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "LabOrder" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Bed" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Bed_branchId_idx" ON "Bed"("branchId");
ALTER TABLE "Bed" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Bed" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Admission" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Admission_branchId_idx" ON "Admission"("branchId");
ALTER TABLE "Admission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Admission" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "PharmacyBatch" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "PharmacyBatch_branchId_idx" ON "PharmacyBatch"("branchId");
ALTER TABLE "PharmacyBatch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "PharmacyBatch" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Dispensing" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Dispensing_branchId_idx" ON "Dispensing"("branchId");
ALTER TABLE "Dispensing" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Dispensing" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "BedStay" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "BedStay_branchId_idx" ON "BedStay"("branchId");
ALTER TABLE "BedStay" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "BedStay" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Service" ADD COLUMN "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT;
CREATE INDEX "Service_branchId_idx" ON "Service"("branchId");
ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Service" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());

ALTER TABLE "PatientBranch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "PatientBranch" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "BranchMembership" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "BranchMembership" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
ALTER TABLE "Branch" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Branch" TO hospital_branch_runtime USING (id=hospital_current_branch());
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "User" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "BranchMembership" m WHERE m."userId"="User".id)) WITH CHECK (true);
ALTER TABLE "Patient" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Patient" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "PatientBranch" m WHERE m."patientId"="Patient".id)) WITH CHECK (true);
CREATE FUNCTION hospital_enroll_created_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='Patient' THEN
  INSERT INTO "PatientBranch" VALUES(NEW.id,hospital_current_branch());
 ELSE
  INSERT INTO "BranchMembership" VALUES(NEW.id,hospital_current_branch());
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enroll_patient AFTER INSERT ON "Patient" FOR EACH ROW EXECUTE FUNCTION hospital_enroll_created_record();
CREATE TRIGGER enroll_staff AFTER INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION hospital_enroll_created_record();
ALTER TABLE "MedicalHistory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "MedicalHistory" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "Patient" p WHERE p.id="MedicalHistory"."patientId")) WITH CHECK (EXISTS (SELECT 1 FROM "Patient" p WHERE p.id="MedicalHistory"."patientId"));
ALTER TABLE "DentalRecord" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "DentalRecord" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "Patient" p WHERE p.id="DentalRecord"."patientId")) WITH CHECK (EXISTS (SELECT 1 FROM "Patient" p WHERE p.id="DentalRecord"."patientId"));
ALTER TABLE "Tooth" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Tooth" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "DentalRecord" r WHERE r.id="Tooth"."dentalRecordId")) WITH CHECK (EXISTS (SELECT 1 FROM "DentalRecord" r WHERE r.id="Tooth"."dentalRecordId"));
ALTER TABLE "DentalCondition" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "DentalCondition" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "Tooth" t WHERE t.id="DentalCondition"."toothId")) WITH CHECK (EXISTS (SELECT 1 FROM "Tooth" t WHERE t.id="DentalCondition"."toothId"));
ALTER TABLE "DoctorProfile" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "DoctorProfile" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id="DoctorProfile"."userId")) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id="DoctorProfile"."userId"));
ALTER TABLE "UserPermission" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "UserPermission" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id="UserPermission"."userId")) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id="UserPermission"."userId"));
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "Session" TO hospital_branch_runtime USING (EXISTS (SELECT 1 FROM "User" u WHERE u.id="Session"."userId")) WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u.id="Session"."userId"));

CREATE FUNCTION hospital_check_visible_links() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE fk record; value text; visible boolean;
BEGIN
 IF current_user <> 'hospital_branch_runtime' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND to_jsonb(OLD)->>'branchId' IS DISTINCT FROM to_jsonb(NEW)->>'branchId' THEN
  RAISE EXCEPTION 'Record branch cannot be changed';
 END IF;
 FOR fk IN SELECT c.confrelid::regclass AS target, a.attname AS source_col, b.attname AS target_col
 FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
 JOIN pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=c.confkey[1]
 WHERE c.contype='f' AND c.conrelid=TG_RELID AND array_length(c.conkey,1)=1 LOOP
  value := to_jsonb(NEW)->>fk.source_col;
  IF value IS NOT NULL THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE %I::text=$1)',fk.target,fk.target_col) INTO visible USING value;
   IF NOT visible THEN RAISE EXCEPTION 'Linked record is unavailable in the active branch'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Department" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Appointment" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "AppointmentRequest" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Treatment" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "TreatmentTooth" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Prescription" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "PrescriptionMedicine" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "InvoiceItem" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Expense" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Document" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Notification" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "ActivityLog" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Encounter" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "ClinicalNote" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "LabOrder" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Bed" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Admission" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "PharmacyBatch" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Dispensing" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "BedStay" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Service" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "MedicalHistory" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "DentalRecord" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "Tooth" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "DentalCondition" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "DoctorProfile" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
