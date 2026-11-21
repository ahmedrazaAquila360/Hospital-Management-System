"use server";

import { revalidatePath } from "next/cache";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { toothUpdateSchema } from "@/lib/validations/dental-chart";

export type ToothUpdateResult = { success: boolean; error?: string };

export async function updateToothConditionAction(input: {
  toothId: string;
  condition: string;
  notes?: string;
  surface?: string;
}): Promise<ToothUpdateResult> {
  const user = await requireUser();
  if (!can(user, "dental_chart.edit")) return { success: false, error: "You don't have permission to do that." };
  const parsed = toothUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { toothId, condition, notes, surface } = parsed.data;

  const tooth = await prisma.tooth.findUnique({
    where: { id: toothId, dentalRecord: { patient: patientScope(user) } },
    include: { dentalRecord: { include: { patient: true } } },
  });
  if (!tooth) return { success: false, error: "Tooth not found." };

  await prisma.$transaction([
    prisma.tooth.update({
      where: { id: toothId, dentalRecord: { patient: patientScope(user) } },
      data: { currentCondition: condition, notes: notes || null },
    }),
    prisma.dentalCondition.create({
      data: {
        toothId,
        condition,
        notes: notes || null,
        surface: surface || null,
        recordedById: user.id,
      },
    }),
  ]);

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "Tooth",
      entityId: toothId,
      description: `${user.name} set tooth ${tooth.toothNumber} to ${condition} for ${tooth.dentalRecord.patient.fullName}.`,
    },
  });

  revalidatePath(`/dental-chart`);
  revalidatePath(`/patients/${tooth.dentalRecord.patientId}`);

  return { success: true };
}
