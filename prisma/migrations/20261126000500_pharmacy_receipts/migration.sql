CREATE TABLE "PharmacyReceipt" (
 id text PRIMARY KEY,"branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "requestId" text NOT NULL,"requestHash" text NOT NULL,"batchId" text NOT NULL REFERENCES "PharmacyBatch"(id) ON DELETE RESTRICT,
 "supplierName" text NOT NULL,quantity integer NOT NULL CHECK(quantity>0),"purchaseTotal" decimal(12,2) NOT NULL CHECK("purchaseTotal">=0),
 "createdById" text NOT NULL REFERENCES "User"(id) ON DELETE RESTRICT,"createdAt" timestamp(3) NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "PharmacyReceipt_branchId_requestId_key" ON "PharmacyReceipt"("branchId","requestId");
CREATE INDEX "PharmacyReceipt_branchId_createdAt_idx" ON "PharmacyReceipt"("branchId","createdAt");
CREATE INDEX "PharmacyReceipt_batchId_idx" ON "PharmacyReceipt"("batchId");
ALTER TABLE "PharmacyReceipt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "PharmacyReceipt" TO hospital_branch_runtime USING("branchId"=hospital_current_branch()) WITH CHECK("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "PharmacyReceipt" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT ON "PharmacyReceipt" TO hospital_branch_runtime;
