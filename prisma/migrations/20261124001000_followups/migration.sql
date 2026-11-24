CREATE TYPE "FollowUpState" AS ENUM ('DUE','BOOKED','COMPLETED','OPTED_OUT','CANCELLED');
ALTER TABLE "Patient" ADD COLUMN "reminderConsent" boolean NOT NULL DEFAULT false;
CREATE TABLE "FollowUp" (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 "branchId" text NOT NULL DEFAULT hospital_current_branch() REFERENCES "Branch"(id) ON DELETE RESTRICT,
 "patientId" text NOT NULL REFERENCES "Patient"(id) ON DELETE RESTRICT,
 "noteId" text NOT NULL UNIQUE REFERENCES "ClinicalNote"(id) ON DELETE RESTRICT,
 "dueDate" date NOT NULL,
 status "FollowUpState" NOT NULL DEFAULT 'DUE',
 "reminderSentAt" timestamp(3),
 "createdAt" timestamp(3) NOT NULL DEFAULT now(),
 "updatedAt" timestamp(3) NOT NULL DEFAULT now()
);
CREATE INDEX "FollowUp_branchId_status_dueDate_idx" ON "FollowUp"("branchId",status,"dueDate");
ALTER TABLE "FollowUp" ENABLE ROW LEVEL SECURITY;
CREATE POLICY branch_scope ON "FollowUp" TO hospital_branch_runtime USING ("branchId"=hospital_current_branch()) WITH CHECK ("branchId"=hospital_current_branch());
CREATE TRIGGER branch_links BEFORE INSERT OR UPDATE ON "FollowUp" FOR EACH ROW EXECUTE FUNCTION hospital_check_visible_links();
GRANT SELECT,INSERT,UPDATE,DELETE ON "FollowUp" TO hospital_branch_runtime;
