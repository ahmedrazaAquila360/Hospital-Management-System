import { z } from "zod";

export const appointmentRequestSchema = z.object({
  fullName: z.string().min(2, "Enter your full name"),
  phone: z.string().min(7, "Enter a valid phone number"),
  email: z.union([z.email("Enter a valid email"), z.literal("")]).optional(),
  preferredDentistId: z.string().optional(),
  preferredDate: z.string().min(1, "Choose a preferred date"),
  preferredTime: z.enum(["MORNING", "AFTERNOON", "EVENING"]),
  reason: z.string().max(500).optional(),
  // Honeypot: real visitors never fill this hidden field; bots often do.
  company: z.string().max(0, "").optional(),
});

export type AppointmentRequestInput = z.infer<typeof appointmentRequestSchema>;

export const PREFERRED_TIME_LABEL: Record<string, string> = {
  MORNING: "Morning (9am–12pm)",
  AFTERNOON: "Afternoon (12pm–4pm)",
  EVENING: "Evening (4pm–6pm)",
};
