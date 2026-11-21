"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser, requirePermission } from "@/lib/auth/guard";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { saveUploadedFile, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";
import {
  clinicSettingsSchema,
  passwordChangeSchema,
  profileSchema,
  systemSettingsSchema,
} from "@/lib/validations/settings";
import { getClinicSettings } from "@/server/settings/queries";
import { normaliseForStorage, parseWorkingHours, validateWorkingHours, type WorkingHours } from "@/lib/working-hours";

export type SettingsFormState = { error?: string; success?: boolean };

export async function updateProfileAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  let avatarUrl: string | undefined;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    if (avatar.size > MAX_UPLOAD_BYTES) return { error: "Photo must be under 10MB." };
    if (!ALLOWED_IMAGE_TYPES.includes(avatar.type)) return { error: "Photo must be a JPG, PNG, or WEBP file." };
    avatarUrl = await saveUploadedFile(avatar, "clinic");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, phone: parsed.data.phone || null, ...(avatarUrl ? { avatarUrl } : {}) },
  });

  revalidatePath("/settings");
  return { success: true };
}

export async function changePasswordAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = passwordChangeSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  // passwordHash is omitted globally (src/lib/prisma.ts); verifying the current password needs it.
  const dbUser = await prisma.user.findUnique({ where: { id: user.id }, omit: { passwordHash: false } });
  if (!dbUser) return { error: "User not found." };

  const valid = await verifyPassword(parsed.data.currentPassword, dbUser.passwordHash);
  if (!valid) return { error: "Current password is incorrect." };

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  return { success: true };
}

export async function updateClinicSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requirePermission("settings.edit");
  const registration = formData.get("registrationNumber");
  if (registration !== null && (typeof registration !== "string" || registration.length > 100)) return { error: "Enter a registration number of up to 100 characters." };
  const parsed = clinicSettingsSchema.safeParse({
    clinicName: formData.get("clinicName"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  let logoUrl: string | undefined;
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > MAX_UPLOAD_BYTES) return { error: "Logo must be under 10MB." };
    if (!ALLOWED_IMAGE_TYPES.includes(logo.type)) return { error: "Logo must be a JPG, PNG, or WEBP file." };
    logoUrl = await saveUploadedFile(logo, "clinic");
  }

  const settings = await getClinicSettings();
  await prisma.clinicSettings.update({
    where: { id: settings.id },
    data: {
      clinicName: parsed.data.clinicName,
      ...(typeof registration === "string" && { registrationNumber: registration.trim() || null }),
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      website: parsed.data.website || null,
      ...(logoUrl ? { logoUrl } : {}),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { success: true };
}

export async function updateSystemSettingsAction(_prev: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  await requirePermission("settings.edit");
  const parsed = systemSettingsSchema.safeParse({
    currency: formData.get("currency"),
    dateFormat: formData.get("dateFormat"),
    timeZone: formData.get("timeZone"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const settings = await getClinicSettings();
  await prisma.clinicSettings.update({ where: { id: settings.id }, data: parsed.data });

  revalidatePath("/settings");
  return { success: true };
}

/** Saves the weekly opening hours (one or more shifts per day) from the Working Hours section. */
export async function updateWorkingHoursAction(hours: WorkingHours): Promise<SettingsFormState> {
  await requirePermission("settings.edit");
  const parsed = parseWorkingHours(hours);
  if (!parsed) return { error: "Working hours are missing." };
  const problem = validateWorkingHours(parsed);
  if (problem) return { error: problem };

  const settings = await getClinicSettings();
  await prisma.clinicSettings.update({ where: { id: settings.id }, data: { workingHours: normaliseForStorage(parsed) } });

  revalidatePath("/settings");
  revalidatePath("/appointments");
  revalidatePath("/", "layout");
  return { success: true };
}
