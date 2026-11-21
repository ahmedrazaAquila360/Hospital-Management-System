import { z } from "zod";

export const medicineSchema = z.object({
  medicineName: z.string().min(1, "Medicine name is required"),
  route: z.string().max(100).optional(),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z.string().min(1, "Frequency is required"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
});

export const prescriptionSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  dentistId: z.string().min(1, "Select a dentist"),
  appointmentId: z.string().optional(),
  instructions: z.string().optional(),
  medicines: z.array(medicineSchema).min(1, "Add at least one medicine"),
});

export type PrescriptionInput = z.infer<typeof prescriptionSchema>;
