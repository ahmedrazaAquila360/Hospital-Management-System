import { z } from "zod";
import { TOOTH_CONDITIONS } from "@/lib/dental";

export const toothUpdateSchema = z.object({
  toothId: z.string().min(1),
  condition: z.enum(TOOTH_CONDITIONS),
  notes: z.string().optional(),
  surface: z.string().optional(),
});

export type ToothUpdateInput = z.infer<typeof toothUpdateSchema>;
