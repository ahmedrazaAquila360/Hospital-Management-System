ALTER TABLE "FollowUp" ADD COLUMN "appointmentId" text UNIQUE REFERENCES "Appointment"(id) ON DELETE RESTRICT;
