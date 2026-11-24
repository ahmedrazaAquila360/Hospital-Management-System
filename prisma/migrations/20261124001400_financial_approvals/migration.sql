CREATE TYPE "FinancialApprovalKind" AS ENUM ('DISCOUNT','REFUND');
CREATE TYPE "FinancialApprovalState" AS ENUM ('REQUESTED','APPLIED','REJECTED');
CREATE TABLE "FinancialApproval" (
 id text PRIMARY KEY,
 "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "invoiceId" text NOT NULL REFERENCES "Invoice"(id) ON DELETE RESTRICT,
 kind "FinancialApprovalKind" NOT NULL,
 status "FinancialApprovalState" NOT NULL DEFAULT 'REQUESTED',
 amount decimal(10,2) NOT NULL CHECK (amount > 0),
 method "PaymentMethod",
 reason text NOT NULL,
 "requestedById" text NOT NULL,
 "requestedAt" timestamp(3) NOT NULL DEFAULT now(),
 "decidedById" text,
 "decidedAt" timestamp(3),
 "decisionReason" text,
 "appliedPaymentId" text
);
CREATE INDEX "FinancialApproval_branchId_status_requestedAt_idx" ON "FinancialApproval"("branchId",status,"requestedAt");
CREATE INDEX "FinancialApproval_invoiceId_status_idx" ON "FinancialApproval"("invoiceId",status);
ALTER TABLE "FinancialApproval" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "FinancialApproval" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "FinancialApproval" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT,UPDATE,DELETE ON "FinancialApproval" TO hospital_branch_runtime;
