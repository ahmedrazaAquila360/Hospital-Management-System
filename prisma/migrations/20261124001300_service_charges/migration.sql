CREATE TYPE "ServiceChargeState" AS ENUM ('PENDING','POSTED','VOIDED');
CREATE TABLE "ServiceCharge" (
 id text PRIMARY KEY,
 "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "patientId" text NOT NULL REFERENCES "Patient"(id) ON DELETE RESTRICT,
 "serviceId" text NOT NULL REFERENCES "Service"(id) ON DELETE RESTRICT,
 quantity integer NOT NULL CHECK (quantity > 0),
 "unitPrice" decimal(10,2) NOT NULL CHECK ("unitPrice" >= 0),
 amount decimal(10,2) NOT NULL CHECK (amount >= 0),
 status "ServiceChargeState" NOT NULL DEFAULT 'PENDING',
 "invoiceItemId" text UNIQUE REFERENCES "InvoiceItem"(id) ON DELETE RESTRICT,
 "createdById" text NOT NULL,
 "createdAt" timestamp(3) NOT NULL DEFAULT now(),
 "postedAt" timestamp(3),
 "voidedAt" timestamp(3),
 "voidReason" text
);
CREATE INDEX "ServiceCharge_branchId_status_createdAt_idx" ON "ServiceCharge"("branchId",status,"createdAt");
CREATE INDEX "ServiceCharge_patientId_status_idx" ON "ServiceCharge"("patientId",status);
ALTER TABLE "ServiceCharge" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "ServiceCharge" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "ServiceCharge" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT,UPDATE,DELETE ON "ServiceCharge" TO hospital_branch_runtime;
