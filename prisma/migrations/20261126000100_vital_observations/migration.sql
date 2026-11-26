CREATE TABLE "VitalObservation" (
 id text PRIMARY KEY, "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id),
 "encounterId" text NOT NULL REFERENCES "Encounter"(id), "authorId" text NOT NULL REFERENCES "User"(id),
 "observedAt" timestamp(3) NOT NULL,"createdAt" timestamp(3) NOT NULL DEFAULT now(), values jsonb NOT NULL,
 "correctionOfId" text UNIQUE REFERENCES "VitalObservation"(id),reason text
);
CREATE INDEX "VitalObservation_branchId_encounterId_observedAt_idx" ON "VitalObservation"("branchId","encounterId","observedAt");
CREATE TABLE "VitalReview" (
 id text PRIMARY KEY,"branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id),
 "observationId" text NOT NULL REFERENCES "VitalObservation"(id),"reviewerId" text NOT NULL REFERENCES "User"(id),
 "createdAt" timestamp(3) NOT NULL DEFAULT now(),note text NOT NULL
);
CREATE INDEX "VitalReview_branchId_observationId_createdAt_idx" ON "VitalReview"("branchId","observationId","createdAt");
DO $$ DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['VitalObservation','VitalReview'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY branch_scope ON %I TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch())',t);
 EXECUTE format('CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links()',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO hospital_branch_runtime',t);
END LOOP; END $$;
INSERT INTO "Permission"(id,key,label,module) VALUES
 ('vitals-view','vitals.view','View vital observations','vitals'),('vitals-create','vitals.create','Record vital observations','vitals'),('vitals-review','vitals.review','Review vital observations','vitals') ON CONFLICT(key) DO NOTHING;
INSERT INTO "RolePermission"(id,"roleId","permissionId") SELECT 'vital-'||r.id||p.id,r.id,p.id FROM "Role" r CROSS JOIN "Permission" p WHERE p.module='vitals' AND (r.name IN ('ADMIN','SUPER_ADMIN','DENTIST') OR (r.name='NURSE' AND p.key IN ('vitals.view','vitals.create'))) ON CONFLICT("roleId","permissionId") DO NOTHING;
