import { validDay } from "@/lib/report-calendar";
import { z } from "zod";

export const APPOINTMENT_TYPES = [
  "CONSULTATION",
  "CHECKUP",
  "CLEANING",
  "FILLING",
  "ROOT_CANAL",
  "EXTRACTION",
  "ORTHODONTIC",
  "SURGERY",
  "FOLLOW_UP",
  "OTHER",
] as const;

export const APPOINTMENT_STATUSES = [
  "SCHEDULED",
  "CONFIRMED",
  "CHECKED_IN",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const appointmentSchema = z
  .object({
    patientId: z.string().min(1, "Select a patient"),
    dentistId: z.string().min(1, "Select a dentist"),
    date: z.string().refine(validDay, "Select a valid calendar date"),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Select a valid start time"),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Select a valid end time"),
    type: z.enum(APPOINTMENT_TYPES),
    notes: z.string().optional(),
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  });

export type AppointmentInput = z.infer<typeof appointmentSchema>;
