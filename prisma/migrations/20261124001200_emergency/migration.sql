CREATE TYPE "EmergencyState" AS ENUM ('REGISTERED','TRIAGED','OPD_TRANSFERRED','IPD_TRANSFERRED','CLOSED');
CREATE TABLE "TriageCategory" (
 id text PRIMARY KEY,
 "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 name text NOT NULL,
 priority integer NOT NULL,
 color text NOT NULL,
 "escalationRule" text,
 active boolean NOT NULL DEFAULT false,
 CONSTRAINT "TriageCategory_branchId_name_key" UNIQUE ("branchId",name)
);
CREATE INDEX "TriageCategory_branchId_active_priority_idx" ON "TriageCategory"("branchId",active,priority);
CREATE TABLE "EmergencyCase" (
 id text PRIMARY KEY,
 "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "patientId" text NOT NULL REFERENCES "Patient"(id) ON DELETE RESTRICT,
 "clinicianId" text REFERENCES "User"(id) ON DELETE RESTRICT,
 "categoryId" text REFERENCES "TriageCategory"(id) ON DELETE RESTRICT,
 status "EmergencyState" NOT NULL DEFAULT 'REGISTERED',
 "presentingConcern" text NOT NULL,
 "recordedById" text NOT NULL,
 "registeredAt" timestamp(3) NOT NULL DEFAULT now(),
 "triagedAt" timestamp(3),
 "appointmentId" text UNIQUE REFERENCES "Appointment"(id) ON DELETE RESTRICT,
 "admissionId" text UNIQUE REFERENCES "Admission"(id) ON DELETE RESTRICT,
 "closedAt" timestamp(3)
);
CREATE INDEX "EmergencyCase_branchId_status_registeredAt_idx" ON "EmergencyCase"("branchId",status,"registeredAt");
CREATE INDEX "EmergencyCase_patientId_registeredAt_idx" ON "EmergencyCase"("patientId","registeredAt");
ALTER TABLE "TriageCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmergencyCase" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "TriageCategory" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE POLICY branch_scope ON "EmergencyCase" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "TriageCategory" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "EmergencyCase" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT,UPDATE,DELETE ON "TriageCategory","EmergencyCase" TO hospital_branch_runtime;
INSERT INTO "Permission"(id,key,label,module) VALUES
('hospital_emergency_view','emergency.view','View emergency worklist','emergency'),
('hospital_emergency_create','emergency.create','Register emergency case','emergency'),
('hospital_emergency_edit','emergency.edit','Update emergency case','emergency'),
('hospital_emergency_manage','emergency.manage','Configure draft triage categories','emergency') ON CONFLICT(key) DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId")
SELECT 'emergency-'||r.id||'-'||p.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE (r.name IN ('SUPER_ADMIN','ADMIN') AND p.key LIKE 'emergency.%')
OR (r.name='RECEPTIONIST' AND p.key IN ('emergency.view','emergency.create'))
OR (r.name IN ('DENTIST','NURSE') AND p.key IN ('emergency.view','emergency.edit'))
ON CONFLICT("roleId","permissionId") DO NOTHING;
