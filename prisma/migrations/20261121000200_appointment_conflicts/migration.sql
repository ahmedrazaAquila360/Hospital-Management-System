BEGIN;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Appointment" ADD CONSTRAINT appointment_positive_duration CHECK ("endTime" > "startTime");
ALTER TABLE "Appointment" ADD CONSTRAINT doctor_available
  EXCLUDE USING gist ("dentistId" WITH =, tsrange("startTime", "endTime", '[)') WITH &&)
  WHERE (status IN ('SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'));
COMMIT;
