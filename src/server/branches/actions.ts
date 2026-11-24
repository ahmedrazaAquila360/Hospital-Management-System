"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireUser, assertPermission } from "@/lib/auth/guard";
import { basePrisma } from "@/lib/prisma-base";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export async function switchBranch(form: FormData) {
  const user = await requireUser();
  const branchId = z.string().min(1).max(100).parse(form.get("branchId"));
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) throw new Error("Sign in again.");
  await basePrisma.$transaction(async tx => {
    await tx.branchMembership.findUniqueOrThrow({where: {userId_branchId: {userId: user.id, branchId}, active: true}});
    await tx.session.update({where: {sessionToken: token, userId: user.id, expires: {gt: new Date()}}, data: {activeBranchId: branchId}});
    await tx.activityLog.create({data: {userId: user.id, branchId, action: "SWITCH_BRANCH", entityType: "Branch", entityId: branchId}});
  });
  revalidatePath("/", "layout");
  redirect("/dashboard");
}
export async function createBranch(form: FormData) {
  const user = await requirePermission("permissions.edit");
  assertPermission(user, "settings.edit");
  const name = z.string().trim().min(2).max(100).parse(form.get("name"));
  const hospital = await basePrisma.clinicSettings.findFirstOrThrow();
  await basePrisma.$transaction(async tx => {
    const branch = await tx.branch.create({data: {name, hospitalId: hospital.id}});
    await tx.branchMembership.create({data: {userId: user.id, branchId: branch.id}});
    await tx.activityLog.create({data: {userId: user.id, branchId: user.activeBranchId, action: "CREATE_BRANCH", entityType: "Branch", entityId: branch.id}});
  });
  revalidatePath("/branches"); revalidatePath("/", "layout");
}
export async function assignBranch(form: FormData) {
  const actor = await requirePermission("permissions.edit");
  assertPermission(actor, "staff.edit");
  const data = z.object({userId: z.string().min(1), branchId: z.string().min(1)}).parse(Object.fromEntries(form));
  await basePrisma.$transaction(async tx => {
    await tx.branchMembership.upsert({where: {userId_branchId: data}, create: data, update: {active: true}});
    await tx.activityLog.create({data: {userId: actor.id, branchId: actor.activeBranchId, action: "ASSIGN_BRANCH", entityType: "User", entityId: data.userId, metadata: {branchId: data.branchId}}});
  });
  revalidatePath("/branches"); revalidatePath("/", "layout");
}
export async function enrollPatient(form: FormData) {
  const actor = await requirePermission("patients.create");
  if (!actor.activeBranchId) throw new Error("Select a branch.");
  const code = z.string().trim().min(1).max(100).parse(form.get("patientCode"));
  await basePrisma.$transaction(async tx => {
    await tx.branchMembership.findUniqueOrThrow({where: {userId_branchId: {userId: actor.id, branchId: actor.activeBranchId!}, active: true}});
    const patient = await tx.patient.findUniqueOrThrow({where: {patientCode: code, archivedAt: null}, select: {id: true}});
    const data = {patientId: patient.id, branchId: actor.activeBranchId!};
    await tx.patientBranch.upsert({where: {patientId_branchId: data}, create: data, update: {}});
    await tx.activityLog.create({data: {userId: actor.id, branchId: actor.activeBranchId, action: "ENROLL_BRANCH", entityType: "Patient", entityId: patient.id}});
  });
  revalidatePath("/patients");
}

export async function revokeBranch(form: FormData) {
  const actor = await requirePermission("permissions.edit");
  assertPermission(actor,"staff.edit");
  const data = z.object({userId: z.string().min(1), branchId: z.string().min(1)}).parse(Object.fromEntries(form));
  if (data.userId === actor.id) throw new Error("Ask another administrator to remove your branch assignment.");
  await basePrisma.$transaction(async tx => {
    await tx.branchMembership.update({where: {userId_branchId: data},data: {active: false}});
    await tx.session.deleteMany({where: {userId: data.userId, activeBranchId: data.branchId}});
    await tx.activityLog.create({data: {userId: actor.id, branchId: actor.activeBranchId, action: "REVOKE_BRANCH", entityType: "User", entityId: data.userId, metadata: {branchId: data.branchId}}});
  });
  revalidatePath("/branches");
}
