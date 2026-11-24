BEGIN;
ALTER TABLE "Invoice" ADD COLUMN "requestId" text, ADD COLUMN "requestHash" text, ADD COLUMN "authorization" jsonb;
CREATE UNIQUE INDEX "Invoice_branchId_requestId_key" ON "Invoice"("branchId","requestId");
COMMIT;
