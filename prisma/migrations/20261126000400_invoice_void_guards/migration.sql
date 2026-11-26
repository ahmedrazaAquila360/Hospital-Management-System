CREATE OR REPLACE FUNCTION hospital_reject_void_invoice_payment() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE voided timestamp; BEGIN
 SELECT "voidedAt" INTO voided FROM "Invoice" WHERE id=NEW."invoiceId" FOR UPDATE;
 IF voided IS NOT NULL THEN RAISE EXCEPTION 'Voided invoices cannot receive payments'; END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION hospital_protect_void_invoice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD."voidedAt" IS NOT NULL THEN RAISE EXCEPTION 'Voided invoices are immutable'; END IF;
 IF NEW."voidedAt" IS NOT NULL THEN
  IF NEW."invoiceNumber" NOT LIKE 'HINV-%' OR length(trim(COALESCE(NEW."voidReason",'')))<3 OR NEW."voidedById" IS NULL THEN RAISE EXCEPTION 'Invalid invoice void'; END IF;
  IF EXISTS(SELECT 1 FROM "Payment" WHERE "invoiceId"=NEW.id) THEN RAISE EXCEPTION 'Paid invoices cannot be voided'; END IF;
  IF EXISTS(SELECT 1 FROM "ServiceCharge" s JOIN "InvoiceItem" i ON i.id=s."invoiceItemId" WHERE i."invoiceId"=NEW.id) THEN RAISE EXCEPTION 'Linked service invoices cannot be voided'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_void_invoice BEFORE UPDATE ON "Invoice" FOR EACH ROW EXECUTE FUNCTION hospital_protect_void_invoice();
