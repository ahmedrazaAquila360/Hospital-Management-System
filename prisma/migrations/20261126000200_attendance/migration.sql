CREATE TABLE "AttendanceShift" (
 id text PRIMARY KEY,"branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id),
 "userId" text NOT NULL REFERENCES "User"(id),"scheduledStart" timestamp(3),"scheduledEnd" timestamp(3),
 "checkedInAt" timestamp(3),"checkedOutAt" timestamp(3),"createdAt" timestamp(3) NOT NULL DEFAULT now(),
 CHECK ("scheduledEnd" IS NULL OR "scheduledEnd">"scheduledStart"),
 CHECK ("checkedOutAt" IS NULL OR ("checkedInAt" IS NOT NULL AND "checkedOutAt">="checkedInAt"))
);
CREATE INDEX "AttendanceShift_branchId_userId_createdAt_idx" ON "AttendanceShift"("branchId","userId","createdAt");
CREATE UNIQUE INDEX "AttendanceShift_one_open" ON "AttendanceShift"("userId") WHERE "checkedInAt" IS NOT NULL AND "checkedOutAt" IS NULL;
ALTER TABLE "AttendanceShift" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "AttendanceShift" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "AttendanceShift" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT,UPDATE ON "AttendanceShift" TO hospital_branch_runtime;
INSERT INTO "Permission"(id,key,label,module) VALUES ('attendance-view','attendance.view','View own attendance','attendance'),('attendance-manage','attendance.manage','Plan and correct staff attendance','attendance') ON CONFLICT(key) DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId") SELECT 'attendance-'||r.id||p.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE p.key='attendance.view' OR (p.key='attendance.manage' AND r.name IN ('ADMIN','SUPER_ADMIN')) ON CONFLICT("roleId","permissionId") DO NOTHING;
