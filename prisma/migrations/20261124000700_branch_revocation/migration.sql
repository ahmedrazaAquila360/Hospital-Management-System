-- Retain membership rows so historical records can still display their staff names.
ALTER TABLE "BranchMembership" ADD COLUMN active boolean NOT NULL DEFAULT true;
