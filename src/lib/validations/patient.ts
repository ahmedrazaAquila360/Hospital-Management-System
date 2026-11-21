import { z } from "zod";

export const patientSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required"),
  dob: z.iso.date().refine(d => d <= new Date().toISOString().slice(0,10), "Date of birth must be in the past or today"),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  phone: z.string().trim().min(7, "A valid phone number is required"),
  email: z.union([z.email("Enter a valid email"), z.literal("")]).optional(),
  address: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  bloodGroup: z
    .enum(["A_POS", "A_NEG", "B_POS", "B_NEG", "AB_POS", "AB_NEG", "O_POS", "O_NEG", "UNKNOWN"])
    .optional(),
  insuranceInfo: z.string().max(1000).optional(),
  surgicalHistory: z.string().max(4000).optional(),
  allergies: z.string().optional(),
  currentMedications: z.string().optional(),
  notes: z.string().optional(),

  // Medical history
  hasDiabetes: z.boolean().default(false),
  hasHypertension: z.boolean().default(false),
  hasHeartCondition: z.boolean().default(false),
  hasBleedingDisorder: z.boolean().default(false),
  isPregnant: z.boolean().default(false),
  isSmoker: z.boolean().default(false),
  otherConditions: z.string().optional(),
  previousDentalHistory: z.string().optional(),
});

export type PatientInput = z.infer<typeof patientSchema>;

export const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
] as const;

export const BLOOD_GROUP_OPTIONS = [
  { value: "A_POS", label: "A+" },
  { value: "A_NEG", label: "A-" },
  { value: "B_POS", label: "B+" },
  { value: "B_NEG", label: "B-" },
  { value: "AB_POS", label: "AB+" },
  { value: "AB_NEG", label: "AB-" },
  { value: "O_POS", label: "O+" },
  { value: "O_NEG", label: "O-" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;
