import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const guardianConfigSchema = z.object({
  enabled: z.boolean().default(true),
  discountAmount: z.number().nonnegative().nullable().default(null),
  discountPercent: z.number().min(0).max(100).nullable().default(null),
  refundAmount: z.number().nonnegative().nullable().default(null),
  approvedByOperator: z.boolean().default(false),
});
export type GuardianConfig = z.infer<typeof guardianConfigSchema>;
export async function getGuardianConfig(): Promise<GuardianConfig> {
  const settings = await prisma.clinicSettings.findFirst({ select: { guardianConfig: true } });
  return guardianConfigSchema.parse(settings?.guardianConfig ?? {});
}
