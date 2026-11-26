import "server-only";
import {requiresPatientAssignment,can,type SessionUser} from "@/lib/permissions";
import {medicationReview} from "@/server/medications/safety";
import {createHash} from "node:crypto";
import {prisma} from "@/lib/prisma";
import {patientScope} from "@/server/patients/access";
import {prescriptionSchema} from "@/lib/validations/prescription";
import type {PrescriptionFormState} from "./actions";
export async function signPrescription(formData:FormData,user:SessionUser,reviewMedicines=medicationReview):Promise<PrescriptionFormState & {prescriptionId?:string;patientId?:string}>{
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
  const provider = await prisma.user.findFirst({where: {id: data.dentistId, status: "ACTIVE", role: {name: "DENTIST"}, branchMemberships: {some: {active: true}}}, select: {id: true}});
  if (!provider) return {error: "Choose an active doctor assigned to this branch."};

  if (requiresPatientAssignment(user) && user.id !== data.dentistId) return { error: "Choose your own doctor account." };
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
  const review = await reviewMedicines(data.medicines.map(m=>m.medicineName), patient.allergies);
  const reviewToken = createHash("sha256").update(review.fingerprint + JSON.stringify(data)).digest("hex");
  if (formData.get("medicationReview") !== reviewToken) return {
    error: "Review medicine verification before signing.", allergies: patient.allergies ?? undefined,
    medicationWarnings: [...review.result.warnings, review.result.limitation], reviewToken,
  };
  const prescription = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Patient" WHERE id=${data.patientId} FOR UPDATE`;
    const current = await tx.patient.findFirstOrThrow({where: {id: data.patientId, AND: [patientScope(user)]}, select: {allergies: true}});
    if (current.allergies !== patient.allergies) throw new Error("Allergies changed. Review the patient again.");
    const saved = await tx.prescription.create({
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
    await tx.activityLog.create({data: {userId: user.id, action: "MEDICATION_REVIEW", entityType: "Prescription", entityId: saved.id, metadata: {...review.result, reviewToken}}});
    await tx.activityLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Prescription",
      entityId: saved.id,
      description: `${user.name} wrote a prescription for ${saved.patient.fullName}.`,
    },
  });
    return saved;
  });



 return {prescriptionId:prescription.id,patientId:prescription.patientId};
}
