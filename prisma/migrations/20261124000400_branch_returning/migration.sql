CREATE OR REPLACE FUNCTION hospital_enroll_created_record() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='Patient' THEN
  PERFORM set_config('hospital.creating_patient',NEW.id,true);
  INSERT INTO "PatientBranch" VALUES(NEW.id,hospital_current_branch());
 ELSE
  PERFORM set_config('hospital.creating_user',NEW.id,true);
  INSERT INTO "BranchMembership" VALUES(NEW.id,hospital_current_branch());
 END IF;
 RETURN NEW;
END $$;
ALTER POLICY branch_scope ON "Patient" USING (id=current_setting('hospital.creating_patient',true) OR EXISTS (SELECT 1 FROM "PatientBranch" m WHERE m."patientId"="Patient".id));
ALTER POLICY branch_scope ON "User" USING (id=current_setting('hospital.creating_user',true) OR EXISTS (SELECT 1 FROM "BranchMembership" m WHERE m."userId"="User".id));
