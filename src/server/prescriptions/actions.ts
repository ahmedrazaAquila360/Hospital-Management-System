"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertPermission, requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { patientScope } from "@/server/patients/access";
import { prescriptionSchema } from "@/lib/validations/prescription";

export type PrescriptionFormState = {
  error?: string;
  allergies?: string;
};

export async function createPrescriptionAction(_prev: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
  const user = await requireUser();
  if (!can(user, "prescriptions.create")) return { error: "You don't have permission to do that." };

  const names = formData.getAll("medicineName") as string[];
  const routes = formData.getAll("route") as string[];
  const dosages = formData.getAll("dosage") as string[];
  const frequencies = formData.getAll("frequency") as string[];
  const durations = formData.getAll("duration") as string[];
  const instructionsList = formData.getAll("medicineInstructions") as string[];

  const medicines = names
    .map((medicineName, i) => ({
      medicineName,
      route: routes[i] || undefined,
      dosage: dosages[i] ?? "",
      frequency: frequencies[i] ?? "",
      duration: durations[i] ?? "",
      instructions: instructionsList[i] || undefined,
    }))
    .filter((m) => m.medicineName.trim().length > 0);

  const parsed = prescriptionSchema.safeParse({
    patientId: formData.get("patientId"),
    dentistId: formData.get("dentistId"),
    appointmentId: formData.get("appointmentId") || undefined,
    instructions: formData.get("instructions") ?? "",
    medicines,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please fix the highlighted fields." };
  }
  const data = parsed.data;

  if (user.role.name === "DENTIST" && user.id !== data.dentistId) return { error: "Choose your own doctor account." };
  if (data.appointmentId && !await prisma.appointment.findFirst({ where: { id: data.appointmentId, patientId: data.patientId, dentistId: data.dentistId }, select: { id: true } })) {
    return { error: "The patient and doctor must match the consultation." };
  }
  const patient = await prisma.patient.findFirst({ where: { id: data.patientId, AND: [patientScope(user)] }, select: { allergies: true } });
  if (!patient) return { error: "Patient unavailable." };
  if (patient.allergies && formData.get("reviewedAllergies") !== patient.allergies) return { error: "Review the recorded allergies before signing.", allergies: patient.allergies };
  const encounterId = formData.get("encounterId");
  if (encounterId) {
    if (typeof encounterId !== "string") return { error: "Invalid encounter." };
    const valid = await prisma.encounter.findFirst({ where: { id: encounterId, OR: [
      { appointment: { is: { patientId: data.patientId, dentistId: data.dentistId, id: data.appointmentId } } },
      { admission: { is: { patientId: data.patientId, doctorId: data.dentistId, dischargedAt: null } } },
    ] } });
    if (!valid) return { error: "Choose the patient and attending doctor for this encounter." };
  }
  const prescription = await prisma.prescription.create({
    data: {
      encounterId: typeof encounterId === "string" ? encounterId : null,
      patientId: data.patientId,
      dentistId: data.dentistId,
      appointmentId: data.appointmentId || null,
      instructions: data.instructions || null,
      medicines: { create: data.medicines },
    },
    include: { patient: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Prescription",
      entityId: prescription.id,
      description: `${user.name} wrote a prescription for ${prescription.patient.fullName}.`,
    },
  });

  revalidatePath("/prescriptions");
  revalidatePath(`/patients/${data.patientId}`);
  redirect(`/prescriptions/${prescription.id}`);
}

export async function deletePrescriptionAction(id: string) {
  const user = await requireUser();
  assertPermission(user, "prescriptions.delete");
  const prescription = await prisma.prescription.delete({ where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }), encounterId: null } });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      entityType: "Prescription",
      entityId: id,
      description: `${user.name} deleted a prescription.`,
    },
  });
  revalidatePath("/prescriptions");
  revalidatePath(`/patients/${prescription.patientId}`);
  redirect("/prescriptions");
}
