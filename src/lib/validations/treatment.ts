import { z } from "zod";
import { isValidToothNumber } from "@/lib/dental";

export const TREATMENT_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const treatmentSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  dentistId: z.string().min(1, "Select a dentist"),
  appointmentId: z.string().optional(),
  name: z.string().min(2, "Treatment name is required"),
  description: z.string().optional(),
  teeth: z.array(z.number().int().refine(isValidToothNumber, "Choose valid FDI tooth numbers")).default([]),
  cost: z.coerce.number().min(0, "Cost must be positive"),
  discount: z.coerce.number().min(0, "Discount must be positive").default(0),
  status: z.enum(TREATMENT_STATUSES).default("PLANNED"),
  startDate: z.string().optional(),
  expectedCompletionDate: z.string().optional(),
});

export type TreatmentInput = z.infer<typeof treatmentSchema>;
