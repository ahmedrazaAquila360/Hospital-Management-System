CREATE TABLE "Supplier"(id text PRIMARY KEY,"branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id),name text NOT NULL,phone text,email text,address text,active boolean NOT NULL DEFAULT true,UNIQUE("branchId",name));
CREATE TABLE "StockMovement"(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,"branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id),"batchId" text NOT NULL REFERENCES "PharmacyBatch"(id),"actorId" text REFERENCES "User"(id),kind text NOT NULL,"sourceId" text,reason text,"before" integer NOT NULL,"after" integer NOT NULL,quantity integer NOT NULL,"purchasePrice" decimal(10,2) NOT NULL,"createdAt" timestamp(3) NOT NULL DEFAULT now(),CHECK("after">=0),CHECK(quantity="after"-"before"));
CREATE INDEX "StockMovement_branchId_batchId_createdAt_idx" ON "StockMovement"("branchId","batchId","createdAt");
INSERT INTO "StockMovement"("branchId","batchId",kind,"before","after",quantity,"purchasePrice",reason) SELECT "branchId",id,'OPENING',0,quantity,quantity,purchase,'Opening balance at stock-ledger activation; prior movements remain in activity history.' FROM "PharmacyBatch";
INSERT INTO "Supplier"(id,"branchId",name) SELECT gen_random_uuid()::text,"branchId",supplier FROM "PharmacyBatch" GROUP BY "branchId",supplier;
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['Supplier','StockMovement'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY branch_scope ON %I TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch())',t);
 EXECUTE format('CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links()',t);
END LOOP; END $$;
GRANT SELECT,INSERT,UPDATE ON "Supplier" TO hospital_branch_runtime;
GRANT SELECT,INSERT ON "StockMovement" TO hospital_branch_runtime;
CREATE FUNCTION hospital_stock_ledger() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE prior integer; BEGIN
 prior:=CASE WHEN TG_OP='INSERT' THEN 0 ELSE OLD.quantity END;
 IF NEW.quantity<0 THEN RAISE EXCEPTION 'Negative pharmacy stock is prohibited'; END IF;
 IF TG_OP='INSERT' OR NEW.quantity<>prior THEN
 INSERT INTO "StockMovement"("branchId","batchId","actorId",kind,"sourceId",reason,"before","after",quantity,"purchasePrice") VALUES(NEW."branchId",NEW.id,NULLIF(current_setting('hospital.stock_actor',true),''),COALESCE(NULLIF(current_setting('hospital.stock_kind',true),''),'SYSTEM'),NULLIF(current_setting('hospital.stock_source',true),''),NULLIF(current_setting('hospital.stock_reason',true),''),prior,NEW.quantity,NEW.quantity-prior,NEW.purchase);
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER pharmacy_stock_ledger AFTER INSERT OR UPDATE OF quantity ON "PharmacyBatch" FOR EACH ROW EXECUTE FUNCTION hospital_stock_ledger();
