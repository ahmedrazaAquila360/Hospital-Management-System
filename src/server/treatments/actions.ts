"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { treatmentSchema } from "@/lib/validations/treatment";
import { PERMANENT_TEETH } from "@/lib/dental";
import type { TreatmentStatus } from "@/generated/prisma/enums";

const NO_PERMISSION = "You don't have permission to manage treatments.";

export type TreatmentFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseForm(formData: FormData) {
  const teethRaw = formData.getAll("teeth");
  return treatmentSchema.safeParse({
    patientId: formData.get("patientId"),
    dentistId: formData.get("dentistId"),
    appointmentId: formData.get("appointmentId") || undefined,
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    teeth: teethRaw.map((t) => Number(t)),
    cost: formData.get("cost"),
    discount: formData.get("discount") || 0,
    status: formData.get("status") || "PLANNED",
    startDate: formData.get("startDate") || undefined,
    expectedCompletionDate: formData.get("expectedCompletionDate") || undefined,
  });
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string") fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

async function syncTreatmentTeeth(treatmentId: string, patientId: string, toothNumbers: number[]) {
  await prisma.treatmentTooth.deleteMany({ where: { treatmentId } });
  if (toothNumbers.length === 0) return;

  // Patients get the 32 permanent teeth when they are created. Primary (child) teeth are
  // added to the record the first time a treatment uses them, and a patient without a dental
  // record gets one, so selected teeth are never silently dropped.
  const dentalRecord = await prisma.dentalRecord.upsert({
    where: { patientId },
    update: {},
    create: { patientId, teeth: { create: PERMANENT_TEETH.map((toothNumber) => ({ toothNumber })) } },
  });
  await prisma.tooth.createMany({
    data: toothNumbers.map((toothNumber) => ({ dentalRecordId: dentalRecord.id, toothNumber })),
    skipDuplicates: true,
  });

  const teeth = await prisma.tooth.findMany({
    where: { dentalRecordId: dentalRecord.id, toothNumber: { in: toothNumbers } },
  });

  await prisma.treatmentTooth.createMany({
    data: teeth.map((t) => ({ treatmentId, toothId: t.id })),
    skipDuplicates: true,
  });
}

export async function createTreatmentAction(_prev: TreatmentFormState, formData: FormData): Promise<TreatmentFormState> {
  const user = await requireUser();
  if (!can(user, "treatments.create")) return { error: NO_PERMISSION };
  const parsed = parseForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), error: "Please fix the highlighted fields." };
  const data = parsed.data;
  if (user.role.name === "DENTIST" && (data.dentistId !== user.id || !await prisma.patient.findFirst({ where: { id: data.patientId, AND: [patientScope(user)] }, select: { id: true } }))) return { error: "Choose an assigned patient and your own doctor account." };

  const treatment = await prisma.treatment.create({
    data: {
      patientId: data.patientId,
      dentistId: data.dentistId,
      appointmentId: data.appointmentId || null,
      name: data.name,
      description: data.description || null,
      cost: data.cost.toFixed(2),
      discount: data.discount.toFixed(2),
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
      completedAt: data.status === "COMPLETED" ? new Date() : null,
    },
    include: { patient: true },
  });

  await syncTreatmentTeeth(treatment.id, data.patientId, data.teeth);

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Treatment",
      entityId: treatment.id,
      description: `${user.name} created treatment "${treatment.name}" for ${treatment.patient.fullName}.`,
    },
  });

  revalidatePath("/treatments");
  revalidatePath(`/patients/${data.patientId}`);
  redirect(`/treatments/${treatment.id}`);
}

export async function updateTreatmentAction(
  id: string,
  _prev: TreatmentFormState,
  formData: FormData
): Promise<TreatmentFormState> {
  const user = await requireUser();
  if (!can(user, "treatments.edit")) return { error: NO_PERMISSION };
  const parsed = parseForm(formData);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), error: "Please fix the highlighted fields." };
  const data = parsed.data;
  if (user.role.name === "DENTIST" && (data.dentistId !== user.id || !await prisma.patient.findFirst({ where: { id: data.patientId, AND: [patientScope(user)] }, select: { id: true } }))) return { error: "Choose an assigned patient and your own doctor account." };

  const existing = await prisma.treatment.findUnique({ where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) } });
  if (!existing) return { error: "Treatment not found." };
  if (existing.status === "COMPLETED" || existing.patientId !== data.patientId) return { error: "Historical treatment identity and completed records cannot be overwritten. Record a new clinical amendment." };

  const treatment = await prisma.treatment.update({
    where: { id, status: { not: "COMPLETED" }, ...(user.role.name === "DENTIST" && { dentistId: user.id }) },
    data: {
      patientId: data.patientId,
      dentistId: data.dentistId,
      appointmentId: data.appointmentId || null,
      name: data.name,
      description: data.description || null,
      cost: data.cost.toFixed(2),
      discount: data.discount.toFixed(2),
      status: data.status,
      startDate: data.startDate ? new Date(data.startDate) : null,
      expectedCompletionDate: data.expectedCompletionDate ? new Date(data.expectedCompletionDate) : null,
      completedAt: data.status === "COMPLETED" ? (existing.completedAt ?? new Date()) : null,
    },
    include: { patient: true },
  });

  await syncTreatmentTeeth(treatment.id, data.patientId, data.teeth);

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "Treatment",
      entityId: id,
      description: `${user.name} updated treatment "${treatment.name}" for ${treatment.patient.fullName}.`,
    },
  });

  revalidatePath("/treatments");
  revalidatePath(`/treatments/${id}`);
  revalidatePath(`/patients/${data.patientId}`);
  redirect(`/treatments/${id}`);
}

export async function updateTreatmentStatusAction(id: string, status: TreatmentStatus) {
  const user = await requireUser();
  if (!can(user, "treatments.edit")) throw new Error(NO_PERMISSION);
  const treatment = await prisma.treatment.update({
    where: { id, status: { not: "COMPLETED" }, ...(user.role.name === "DENTIST" && { dentistId: user.id }) },
    data: { status, completedAt: status === "COMPLETED" ? new Date() : null },
    include: { patient: true, dentist: true },
  });

  if (status === "COMPLETED") {
    const admins = await prisma.user.findMany({
      where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN"] } } },
      select: { id: true },
    });
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "TREATMENT_COMPLETED" as const,
        title: "Treatment completed",
        message: `${treatment.name} for ${treatment.patient.fullName} was marked complete.`,
        link: `/treatments/${id}`,
      })),
    });
  }

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "STATUS_CHANGE",
      entityType: "Treatment",
      entityId: id,
      description: `${user.name} marked "${treatment.name}" as ${status.toLowerCase().replace("_", " ")}.`,
    },
  });

  revalidatePath("/treatments");
  revalidatePath(`/treatments/${id}`);
  revalidatePath(`/patients/${treatment.patientId}`);
  revalidatePath("/dashboard");
}

export async function deleteTreatmentAction(id: string): Promise<{ error?: string }> {
  const user = await requireUser();
  if (!can(user, "treatments.delete")) return { error: NO_PERMISSION };
  const treatment = await prisma.treatment.delete({ where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) } }).catch(() => null);
  if (!treatment) return { error: "This treatment no longer exists." };
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      entityType: "Treatment",
      entityId: id,
      description: `${user.name} deleted treatment "${treatment.name}".`,
    },
  });
  revalidatePath("/treatments");
  revalidatePath(`/patients/${treatment.patientId}`);
  return {};
}
