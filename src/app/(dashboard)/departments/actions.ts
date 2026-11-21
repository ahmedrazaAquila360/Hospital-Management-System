"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

export async function saveDepartment(form: FormData) {
  const user = await requirePermission("settings.edit");
  const id = form.get("id");
  const name = form.get("name");
  if (typeof name !== "string" || !name.trim() || name.trim().length > 100)
    throw new Error("Enter a department name of up to 100 characters.");
  const data = { name: name.trim(), active: form.get("active") === "on" };
  await prisma.$transaction(async (tx) => {
    const department =
      typeof id === "string"
        ? await tx.department.update({ where: { id }, data })
        : await tx.department.create({ data });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: id ? "UPDATE" : "CREATE",
        entityType: "Department",
        entityId: department.id,
        metadata: data,
      },
    });
  });
  revalidatePath("/departments");
}

export async function assignDepartment(form: FormData) {
  const actor = await requirePermission("staff.edit");
  await requirePermission("settings.edit");
  const staffId = form.get("staffId");
  const departmentId = form.get("departmentId");
  if (typeof staffId !== "string" || typeof departmentId !== "string")
    throw new Error("Choose a staff member and department.");
  await prisma.$transaction(async (tx) => {
    if (departmentId) await tx.department.findFirstOrThrow({ where: { id: departmentId, active: true } });
    await tx.user.update({ where: { id: staffId }, data: { departmentId: departmentId || null } });
    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "UPDATE",
        entityType: "User",
        entityId: staffId,
        metadata: { departmentId },
      },
    });
  });
  revalidatePath("/departments");
}

export async function saveService(form: FormData) {
  await requirePermission("settings.edit");
  const name = String(form.get("name") ?? "").trim();
  const departmentId = String(form.get("departmentId") ?? "");
  const category = String(form.get("category") ?? "").trim();
  const price = String(form.get("price") ?? "");
  if (
    !name ||
    name.length > 150 ||
    !category ||
    category.length > 100 ||
    !/^\d{1,8}(\.\d{1,2})?$/.test(price)
  )
    throw new Error("Enter the service name, category and price.");
  await prisma.department.findFirstOrThrow({ where: { id: departmentId, active: true } });
  await prisma.service.upsert({
    where: { name },
    create: { name, category, departmentId, price },
    update: { category, departmentId, price },
  });
  revalidatePath("/departments");
}
