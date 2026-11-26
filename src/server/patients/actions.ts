"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { assertPermission, requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { saveUploadedFile, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { patientScope } from "./access";
import { patientSchema } from "@/lib/validations/patient";


export type PatientFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function formBool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

export async function createPatientAction(_prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const user = await requireUser();
  if (!can(user, "patients.create")) return { error: "You don't have permission to do that." };

  const parsed = patientSchema.safeParse({
    fullName: formData.get("fullName"),
    dob: formData.get("dob"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    emergencyContactName: formData.get("emergencyContactName") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    bloodGroup: formData.get("bloodGroup") || undefined,
    insuranceInfo: formData.get("insuranceInfo") ?? undefined,
    surgicalHistory: formData.get("surgicalHistory") ?? undefined,
    allergies: formData.get("allergies") ?? "",
    currentMedications: formData.get("currentMedications") ?? "",
    notes: formData.get("notes") ?? "",
    hasDiabetes: formBool(formData, "hasDiabetes"),
    hasHypertension: formBool(formData, "hasHypertension"),
    hasHeartCondition: formBool(formData, "hasHeartCondition"),
    hasBleedingDisorder: formBool(formData, "hasBleedingDisorder"),
    isPregnant: formBool(formData, "isPregnant"),
    isSmoker: formBool(formData, "isSmoker"),
    otherConditions: formData.get("otherConditions") ?? "",
    previousDentalHistory: formData.get("previousDentalHistory") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") fieldErrors[field] = issue.message;
    }
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }

  let photoUrl: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_UPLOAD_BYTES) return { error: "Photo must be under 10MB." };
    if (!ALLOWED_IMAGE_TYPES.includes(photo.type)) return { error: "Photo must be a JPG, PNG, or WEBP file." };
    photoUrl = await saveUploadedFile(photo, "patients");
  }

  const data = parsed.data;
  const {registerPatient}=await import("./register");
  const result=await registerPatient(data,user,photoUrl);
  if (!result.patient) return { error: `A matching patient is already registered under ${result.duplicate}.` };
  const { patient } = result;

  revalidatePath("/patients");
  redirect(`/patients/${patient.id}`);
}

export async function updatePatientAction(id: string, _prev: PatientFormState, formData: FormData): Promise<PatientFormState> {
  const user = await requireUser();
  if (!can(user, "patients.edit")) return { error: "You don't have permission to do that." };

  const parsed = patientSchema.safeParse({
    fullName: formData.get("fullName"),
    dob: formData.get("dob"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    emergencyContactName: formData.get("emergencyContactName") ?? "",
    emergencyContactPhone: formData.get("emergencyContactPhone") ?? "",
    bloodGroup: formData.get("bloodGroup") || undefined,
    insuranceInfo: formData.get("insuranceInfo") ?? undefined,
    surgicalHistory: formData.get("surgicalHistory") ?? undefined,
    allergies: formData.get("allergies") ?? "",
    currentMedications: formData.get("currentMedications") ?? "",
    notes: formData.get("notes") ?? "",
    hasDiabetes: formBool(formData, "hasDiabetes"),
    hasHypertension: formBool(formData, "hasHypertension"),
    hasHeartCondition: formBool(formData, "hasHeartCondition"),
    hasBleedingDisorder: formBool(formData, "hasBleedingDisorder"),
    isPregnant: formBool(formData, "isPregnant"),
    isSmoker: formBool(formData, "isSmoker"),
    otherConditions: formData.get("otherConditions") ?? "",
    previousDentalHistory: formData.get("previousDentalHistory") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === "string") fieldErrors[field] = issue.message;
    }
    return { fieldErrors, error: "Please fix the highlighted fields." };
  }

  const data = parsed.data;
  let photoUrl: string | undefined;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_UPLOAD_BYTES) return { error: "Photo must be under 10MB." };
    if (!ALLOWED_IMAGE_TYPES.includes(photo.type)) return { error: "Photo must be a JPG, PNG, or WEBP file." };
    photoUrl = await saveUploadedFile(photo, "patients");
  }

  await prisma.patient.update({
    where: { id, AND: [patientScope(user)] },
    data: {
      fullName: data.fullName,
      ...(photoUrl ? { photoUrl } : {}),
      dob: new Date(data.dob),
      gender: data.gender,
      phone: data.phone,
      email: data.email || null,
      address: data.address || null,
      emergencyContactName: data.emergencyContactName || null,
      emergencyContactPhone: data.emergencyContactPhone || null,
      bloodGroup: data.bloodGroup,
      insuranceInfo: data.insuranceInfo,
      surgicalHistory: data.surgicalHistory,
      allergies: data.allergies || null,
      currentMedications: data.currentMedications || null,
      notes: data.notes || null,
      medicalHistory: {
        upsert: {
          create: {
            hasDiabetes: data.hasDiabetes,
            hasHypertension: data.hasHypertension,
            hasHeartCondition: data.hasHeartCondition,
            hasBleedingDisorder: data.hasBleedingDisorder,
            isPregnant: data.isPregnant,
            isSmoker: data.isSmoker,
            otherConditions: data.otherConditions || null,
            previousDentalHistory: data.previousDentalHistory || null,
          },
          update: {
            hasDiabetes: data.hasDiabetes,
            hasHypertension: data.hasHypertension,
            hasHeartCondition: data.hasHeartCondition,
            hasBleedingDisorder: data.hasBleedingDisorder,
            isPregnant: data.isPregnant,
            isSmoker: data.isSmoker,
            otherConditions: data.otherConditions || null,
            previousDentalHistory: data.previousDentalHistory || null,
          },
        },
      },
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "Patient",
      entityId: id,
      description: `${user.name} updated patient details.`,
    },
  });

  revalidatePath(`/patients/${id}`);
  revalidatePath("/patients");
  redirect(`/patients/${id}`);
}

export async function deletePatientAction(id: string) {
  const user = await requireUser();
  assertPermission(user, "patients.delete");
  const patient = await prisma.patient.update({ where: { id, AND: [patientScope(user)], admissions: { none: { dischargedAt: null, status: { not: "CANCELLED" } } } }, data: { archivedAt: new Date() } });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "ARCHIVE",
      entityType: "Patient",
      entityId: id,
      description: `${user.name} archived patient ${patient.fullName} (${patient.patientCode}).`,
    },
  });
  revalidatePath("/patients");
  redirect("/patients");
}
