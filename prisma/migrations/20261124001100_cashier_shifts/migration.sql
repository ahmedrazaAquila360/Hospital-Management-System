CREATE TYPE "CashierShiftStatus" AS ENUM ('OPEN','SUBMITTED','APPROVED');
CREATE TABLE "CashierShift" (
 id text PRIMARY KEY,
 "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "cashierId" text NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,
 "openingCash" decimal(10,2) NOT NULL,
 "countedCash" decimal(10,2),
 "expectedCash" decimal(10,2),
 "discrepancy" decimal(10,2),
 status "CashierShiftStatus" NOT NULL DEFAULT 'OPEN',
 "openedAt" timestamp(3) NOT NULL DEFAULT now(),
 "submittedAt" timestamp(3),
 "approvedAt" timestamp(3),
 "approvedById" text
);
CREATE INDEX "CashierShift_branchId_status_openedAt_idx" ON "CashierShift"("branchId",status,"openedAt");
CREATE INDEX "CashierShift_cashierId_openedAt_idx" ON "CashierShift"("cashierId","openedAt");
CREATE UNIQUE INDEX "CashierShift_one_open_per_cashier" ON "CashierShift"("branchId","cashierId") WHERE status='OPEN';
ALTER TABLE "Payment" ADD COLUMN "cashierShiftId" text REFERENCES "CashierShift"(id) ON DELETE RESTRICT;
CREATE INDEX "Payment_cashierShiftId_idx" ON "Payment"("cashierShiftId");
ALTER TABLE "CashierShift" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "CashierShift" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "CashierShift" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT,UPDATE,DELETE ON "CashierShift" TO hospital_branch_runtime;
INSERT INTO "Permission"(id,key,label,module) VALUES
('hospital_billing_shifts','billing.shifts','Cashier shifts','billing'),
('hospital_billing_shift_approve','billing.shiftApprove','Approve cashier close','billing') ON CONFLICT(key) DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId")
SELECT 'cashier-shift-'||r.id||'-'||p.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p
WHERE (r.name IN ('SUPER_ADMIN','ADMIN','BILLING_OFFICER') AND p.key IN ('billing.shifts','billing.shiftApprove'))
OR (r.name='CASHIER' AND p.key='billing.shifts')
ON CONFLICT("roleId","permissionId") DO NOTHING;
