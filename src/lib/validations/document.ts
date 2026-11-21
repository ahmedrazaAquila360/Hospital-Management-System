import { z } from "zod";

export const DOCUMENT_TYPES = ["XRAY", "REPORT", "IMAGE", "PDF", "OTHER"] as const;

export const documentUploadSchema = z.object({
  patientId: z.string().optional(),
  name: z.string().min(1, "Document name is required"),
  type: z.enum(DOCUMENT_TYPES),
});
