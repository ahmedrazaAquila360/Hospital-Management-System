ALTER TABLE "ClinicSettings" ADD COLUMN IF NOT EXISTS "guardianConfig" jsonb;
DO $$ BEGIN CREATE TYPE "RevenueAlertStatus" AS ENUM ('OPEN','REVIEWED','RESOLVED','DISMISSED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS "RevenueAlert" (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "branchId" text NOT NULL REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "patientId" text REFERENCES "Patient"(id) ON DELETE RESTRICT,
 rule text NOT NULL,
 "sourceId" text NOT NULL,
 evidence jsonb NOT NULL,
 impact decimal(10,2),
 severity text NOT NULL,
 status "RevenueAlertStatus" NOT NULL DEFAULT 'OPEN',
 "assignedToId" text,
 "reviewedById" text,
 "reviewedAt" timestamp(3),
 "resolvedAt" timestamp(3),
 "dismissedReason" text,
 "createdAt" timestamp(3) NOT NULL DEFAULT now(),
 "updatedAt" timestamp(3) NOT NULL DEFAULT now(),
 CONSTRAINT "RevenueAlert_branchId_rule_sourceId_key" UNIQUE ("branchId",rule,"sourceId")
);
CREATE INDEX IF NOT EXISTS "RevenueAlert_branchId_status_createdAt_idx" ON "RevenueAlert"("branchId",status,"createdAt");
ALTER TABLE "RevenueAlert" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY branch_scope ON "RevenueAlert" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch()); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "RevenueAlert" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON "RevenueAlert" TO hospital_branch_runtime;
INSERT INTO "Permission"(id,key,label,module) VALUES
('hospital_billing_guardian','billing.guardian','Revenue Guardian','billing'),
('hospital_billing_guardian_manage','billing.guardianManage','Guardian configuration','billing') ON CONFLICT(key) DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId")
SELECT 'guardian-admin-'||r.id||'-'||p.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.name IN ('SUPER_ADMIN','ADMIN','BILLING_OFFICER') AND p.key IN ('billing.guardian','billing.guardianManage')
ON CONFLICT("roleId","permissionId") DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId")
SELECT 'guardian-cashier-'||r.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE r.name='CASHIER' AND p.key='billing.guardian'
ON CONFLICT("roleId","permissionId") DO NOTHING;
