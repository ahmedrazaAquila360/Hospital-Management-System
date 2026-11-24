-- Membership must exist when INSERT ... RETURNING applies the SELECT policy.
ALTER TABLE "BranchMembership" ALTER CONSTRAINT "BranchMembership_userId_fkey" DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE "PatientBranch" ALTER CONSTRAINT "PatientBranch_patientId_fkey" DEFERRABLE INITIALLY DEFERRED;
DROP TRIGGER enroll_patient ON "Patient";
DROP TRIGGER enroll_staff ON "User";
CREATE TRIGGER enroll_patient BEFORE INSERT ON "Patient" FOR EACH ROW EXECUTE FUNCTION hospital_enroll_created_record();
CREATE TRIGGER enroll_staff BEFORE INSERT ON "User" FOR EACH ROW EXECUTE FUNCTION hospital_enroll_created_record();
