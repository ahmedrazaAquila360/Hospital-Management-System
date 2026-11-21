"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import { can, SUPER_ADMIN } from "@/lib/permissions";
import { saveUploadedFile, ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "@/lib/storage";
import { hashPassword } from "@/lib/auth/password";
import { createStaffSchema, staffSchema } from "@/lib/validations/staff";

export type StaffFormState = { error?: string; fieldErrors?: Record<string, string> };

// These actions used to check only for a signed-in user, so any account (even Staff) could
// create an admin or change its own role. Managing staff now needs staff.manage.
const NO_PERMISSION = "You don't have permission to manage staff.";
const ONLY_SUPER_ADMIN = "Only a Super Admin can assign or change Super Admin accounts.";

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string") fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

async function handleAvatarUpload(formData: FormData): Promise<{ url?: string; error?: string }> {
  const avatar = formData.get("avatar");
  if (!(avatar instanceof File) || avatar.size === 0) return {};
  if (avatar.size > MAX_UPLOAD_BYTES) return { error: "Photo must be under 10MB." };
  if (!ALLOWED_IMAGE_TYPES.includes(avatar.type)) return { error: "Photo must be a JPG, PNG, or WEBP file." };
  return { url: await saveUploadedFile(avatar, "clinic") };
}

export async function createStaffAction(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const actor = await requireUser();
  if (!can(actor, "staff.create")) return { error: NO_PERMISSION };

  const parsed = createStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    joiningDate: formData.get("joiningDate") || undefined,
    password: formData.get("password"),
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), error: "Please fix the highlighted fields." };
  const data = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: data.email } });
  if (existing) return { error: "A user with this email already exists." };

  const role = await prisma.role.findUnique({ where: { name: data.role } });
  if (!role) return { error: "Invalid role selected." };
  if (role.name === SUPER_ADMIN && actor.role.name !== SUPER_ADMIN) return { error: ONLY_SUPER_ADMIN };

  const { url: avatarUrl, error: avatarError } = await handleAvatarUpload(formData);
  if (avatarError) return { error: avatarError };

  const passwordHash = await hashPassword(data.password);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone || null,
      avatarUrl,
      roleId: role.id,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      description: `${actor.name} added staff member ${user.name} (${role.label}).`,
    },
  });

  revalidatePath("/staff");
  redirect(`/staff/${user.id}/edit`);
}

export async function updateStaffAction(id: string, _prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const actor = await requireUser();
  if (!can(actor, "staff.edit")) return { error: NO_PERMISSION };

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? "",
    role: formData.get("role"),
    joiningDate: formData.get("joiningDate") || undefined,
  });
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), error: "Please fix the highlighted fields." };
  const data = parsed.data;

  const role = await prisma.role.findUnique({ where: { name: data.role } });
  if (!role) return { error: "Invalid role selected." };
  if (actor.role.name !== SUPER_ADMIN) {
    const target = await prisma.user.findUnique({ where: { id }, select: { role: { select: { name: true } } } });
    if (role.name === SUPER_ADMIN || target?.role.name === SUPER_ADMIN) return { error: ONLY_SUPER_ADMIN };
  }
  // A duplicate email used to surface as an unhandled database error.
  const clash = await prisma.user.findFirst({ where: { email: data.email, NOT: { id } }, select: { id: true } });
  if (clash) return { fieldErrors: { email: "Another user already uses this email." }, error: "Please fix the highlighted fields." };

  const { url: avatarUrl, error: avatarError } = await handleAvatarUpload(formData);
  if (avatarError) return { error: avatarError };

  const user = await prisma.user.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      roleId: role.id,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : undefined,
      ...(avatarUrl ? { avatarUrl } : {}),
    },
  });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      description: `${actor.name} updated staff member ${user.name}.`,
    },
  });

  revalidatePath("/staff");
  redirect("/staff");
}

export async function toggleStaffStatusAction(id: string) {
  const actor = await requireUser();
  if (!can(actor, "staff.edit")) return;
  const user = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!user) return;
  if (user.id === actor.id) return;
  if (user.role.name === SUPER_ADMIN && actor.role.name !== SUPER_ADMIN) return;

  const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  await prisma.user.update({ where: { id }, data: { status: nextStatus } });

  await prisma.activityLog.create({
    data: {
      userId: actor.id,
      action: "STATUS_CHANGE",
      entityType: "User",
      entityId: id,
      description: `${actor.name} set ${user.name}'s status to ${nextStatus}.`,
    },
  });

  revalidatePath("/staff");
}
