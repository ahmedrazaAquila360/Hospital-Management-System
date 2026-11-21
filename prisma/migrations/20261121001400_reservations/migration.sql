BEGIN;
DROP INDEX one_current_bed;
DROP INDEX one_current_admission;
CREATE UNIQUE INDEX one_current_bed ON "Admission" ("bedId") WHERE status NOT IN ('DISCHARGED','CANCELLED');
CREATE UNIQUE INDEX one_current_admission ON "Admission" ("patientId") WHERE status NOT IN ('DISCHARGED','CANCELLED');
CREATE SEQUENCE hospital_invoice_number;
COMMIT;
