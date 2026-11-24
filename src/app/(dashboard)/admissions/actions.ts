"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { paymentSchema } from "@/lib/validations/invoice";
import { createAdmission, changeAdmission, postAdmissionDeposit } from "@/server/admissions/transactions";
import { prisma } from "@/lib/prisma";

const identifier = z.string().trim().min(1).max(100);

export async function addBed(form: FormData) {
  await requirePermission("ipd.manage");
  const data = z
    .object({
      ward: identifier,
      room: identifier,
      label: identifier,
      category: identifier,
      nightlyRate: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
    })
    .parse(Object.fromEntries(form));
  await prisma.bed.create({ data });
  revalidatePath("/admissions");
}

export async function housekeeping(form: FormData) {
  await requirePermission("ipd.manage");
  const id = identifier.parse(form.get("bedId"));
  const status = z.enum(["AVAILABLE", "CLEANING", "RESERVED", "MAINTENANCE"]).parse(form.get("status"));
  await prisma.bed.update({ where: { id, status: { not: "OCCUPIED" }, admissions: { none: { status:"REQUESTED" } } }, data: { status } });
  revalidatePath("/admissions");
}

export async function admit(form: FormData) {
  const user = await requirePermission("ipd.create");
  assertPermission(user, "ipd.view");
  const data = z
    .object({
      patientCode: identifier,
      doctorId: identifier,
      bedId: identifier,
      diagnosis: z.string().trim().min(1).max(4000),
    })
    .parse(Object.fromEntries(form));
  const requestOnly = form.get("requestOnly") === "on";
  const deposit = z.coerce
    .number()
    .min(0)
    .max(99999999)
    .multipleOf(0.01)
    .parse(form.get("deposit") || 0);
  if (requestOnly && deposit) throw new Error("Receive deposits at admission.");
  const method = paymentSchema.shape.method.parse(form.get("method") || "CASH");
  if (deposit > 0 && !can(user, "billing.payments"))
    throw new Error("Payment permission is required for a deposit.");
  await createAdmission(data, requestOnly, deposit, method, user.id);
  revalidatePath("/admissions");
}

export async function updateAdmission(form: FormData) {
  const action = z.enum(["transfer", "request", "discharge","confirm","cancel","activate"]).parse(form.get("action"));
  const actor = await requirePermission(action === "discharge" ? "ipd.approve" : action === "confirm" || action === "cancel" ? "ipd.create" : "ipd.edit");
  assertPermission(actor, "ipd.view");
  const id = identifier.parse(form.get("id"));
  await changeAdmission(id, action, form, actor.id);
  revalidatePath("/admissions");
}

export async function collectDeposit(form: FormData) {
  const actor = await requirePermission("ipd.view");
  if (!can(actor, "billing.payments")) throw new Error("Payment permission is required for a deposit.");
  const data = z.object({
    id: identifier,
    amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
    expectedTotal: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
    method: paymentSchema.shape.method,
  }).parse(Object.fromEntries(form));
  await postAdmissionDeposit(data, actor.id);
  revalidatePath("/admissions");
  revalidatePath("/billing/invoices");
}
