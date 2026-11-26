ALTER TABLE "Invoice" ADD COLUMN "voidedAt" timestamp(3), ADD COLUMN "voidedById" text, ADD COLUMN "voidReason" text;
CREATE INDEX "Invoice_branchId_voidedAt_idx" ON "Invoice"("branchId","voidedAt");
INSERT INTO "Permission"(id,key,label,module) VALUES ('hospital_billing_void','billing.void','Void unpaid manual invoice','billing') ON CONFLICT(key) DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId") SELECT 'billing-void-'||r.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE r.name IN ('ADMIN','SUPER_ADMIN') AND p.key='billing.void' ON CONFLICT("roleId","permissionId") DO NOTHING;
CREATE OR REPLACE FUNCTION hospital_reject_void_invoice_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM "Invoice" WHERE id=NEW."invoiceId" AND "voidedAt" IS NOT NULL) THEN
  RAISE EXCEPTION 'Voided invoices cannot receive payments';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reject_void_invoice_payment BEFORE INSERT ON "Payment" FOR EACH ROW EXECUTE FUNCTION hospital_reject_void_invoice_payment();
