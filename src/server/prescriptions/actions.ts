"use server";
import { requiresPatientAssignment } from "@/lib/permissions";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertPermission, requireUser } from "@/lib/auth/guard";

export type PrescriptionFormState = {
  error?: string;
  allergies?: string;
  medicationWarnings?: string[];
  reviewToken?: string;
};

export async function createPrescriptionAction(_prev: PrescriptionFormState, formData: FormData): Promise<PrescriptionFormState> {
 const user=await requireUser();const {signPrescription}=await import('./sign');
 const result=await signPrescription(formData,user);if(!result.prescriptionId)return result;
 revalidatePath('/prescriptions');revalidatePath(`/patients/${result.patientId}`);redirect(`/prescriptions/${result.prescriptionId}`);
}

export async function deletePrescriptionAction(id: string) {
  const user = await requireUser();
  assertPermission(user, "prescriptions.delete");
  const prescription = await prisma.prescription.delete({ where: { id, ...(requiresPatientAssignment(user) && { dentistId: user.id }), encounterId: null } });
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
