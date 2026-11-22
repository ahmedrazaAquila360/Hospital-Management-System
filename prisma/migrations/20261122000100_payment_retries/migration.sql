-- Nullable for historical payments, refunds and admission deposits.
ALTER TABLE "Payment" ADD COLUMN "requestId" TEXT;
CREATE UNIQUE INDEX "Payment_invoiceId_requestId_key" ON "Payment"("invoiceId", "requestId");
