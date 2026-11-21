"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { paymentSchema } from "@/lib/validations/invoice";
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
  await prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUniqueOrThrow({ where: { patientCode: data.patientCode, archivedAt: null } });
    const doctor = await tx.user.findFirstOrThrow({
      where: { id: data.doctorId, status: "ACTIVE", department: { active: true }, role: { name: "DENTIST" } },
    });
    if (!doctor.departmentId) throw new Error("Assign the doctor to a department first.");
    const bed = await tx.bed.update({
      where: { id: data.bedId, status: "AVAILABLE" },
      data: { status: requestOnly ? "RESERVED" : "OCCUPIED" },
    });
    const admission = await tx.admission.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        bedId: data.bedId,
        diagnosis: data.diagnosis, status: requestOnly ? "REQUESTED" : "ADMITTED",
      },
    });
    if (!requestOnly) await tx.bedStay.create({
      data: {
        bedId: bed.id,
        admissionId: admission.id,
        start: admission.admittedAt,
        nightlyRate: bed.nightlyRate,
      },
    });
    if (deposit > 0)
      await tx.invoice.create({
        data: {
          invoiceNumber: "IPD-" + admission.number,
          patientId: patient.id,
          dentistId: doctor.id,
          createdById: user.id,
          subtotal: deposit,
          total: deposit,
          status: "PAID",
          items: {
            create: { description: "Admission deposit", quantity: 1, unitPrice: deposit, amount: deposit },
          },
          payments: {
            create: {
              patientId: patient.id,
              receivedById: user.id,
              amount: deposit,
              method,
              reference: "Admission deposit",
            },
          },
        },
      });
    await tx.notification.create({
      data: {
        userId: doctor.id,
        type: "SYSTEM",
        title: "New inpatient admission",
        message: "Admission #" + admission.number,
        link: "/opd",
      },
    });
    if (!requestOnly) await tx.encounter.create({ data: { admissionId: admission.id } });
    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: requestOnly ? "REQUEST" : "ADMIT",
        entityType: "Admission",
        entityId: admission.id,
        metadata: { bedId: data.bedId },
      },
    });
  });
  revalidatePath("/admissions");
}

export async function updateAdmission(form: FormData) {
  const action = z.enum(["transfer", "request", "discharge","confirm","cancel","activate"]).parse(form.get("action"));
  const actor = await requirePermission(action === "discharge" ? "ipd.approve" : action === "confirm" || action === "cancel" ? "ipd.create" : "ipd.edit");
  const id = identifier.parse(form.get("id"));
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Admission" WHERE id = ${id} FOR UPDATE`;
    const admission = await tx.admission.findFirstOrThrow({ where: { id, dischargedAt: null, status: { not:"CANCELLED" } } });
    const now = new Date();
    if (admission.status === "REQUESTED") {
      if (action !== "confirm" && action !== "cancel") throw new Error("Confirm or cancel the admission request.");
      const bed = await tx.bed.update({ where: { id: admission.bedId, status: "RESERVED" }, data: { status: action === "confirm" ? "OCCUPIED" : "AVAILABLE" } });
      await tx.admission.update({ where: { id }, data: action === "confirm" ? { status:"ADMITTED", admittedAt:now } : { status:"CANCELLED" } });
      if (action === "confirm") {
        await tx.encounter.create({ data: { admissionId:id } });
        await tx.bedStay.create({ data: { admissionId:id, bedId:bed.id, start:now, nightlyRate:bed.nightlyRate } });
      }
    } else if (action === "confirm" || action === "cancel") throw new Error("The request has already been processed.");
    else if (action === "activate") {
      await tx.admission.update({ where: { id, status:"ADMITTED" }, data: { status:"ACTIVE" } });
    } else if (action === "discharge") {
      if (admission.status !== "DISCHARGE_REQUESTED") throw new Error("Request discharge first.");
      const summary = z.string().trim().min(1).max(8000).parse(form.get("summary"));
      await tx.bedStay.updateMany({ where: { admissionId: id, end: null }, data: { end: now } });
      const stays = await tx.bedStay.findMany({
        where: { admissionId: id },
        include: { bed: true },
        orderBy: { start: "asc" },
      });
      const settings = await tx.clinicSettings.findFirst({ select: { timeZone: true } });
      const calendar = new Intl.DateTimeFormat("en-CA", {
        timeZone: settings?.timeZone ?? "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const day = (time: Date) => Date.parse(calendar.format(time)) / 86400000;
      const sameDay = day(now) === day(admission.admittedAt);
      const items = stays.flatMap((stay, index) => {
        const quantity = sameDay && index === stays.length - 1 ? 1 : day(stay.end ?? now) - day(stay.start);
        return quantity > 0
          ? [
              {
                description: `Bed · ${stay.bed.ward} / ${stay.bed.room} / ${stay.bed.label}`,
                quantity,
                unitPrice: stay.nightlyRate,
                amount: stay.nightlyRate.mul(quantity),
              },
            ]
          : [];
      });
      const total = items.reduce((sum, item) => sum + Math.round(item.amount.toNumber() * 100), 0) / 100;
      const invoiceNumber = "IPD-" + admission.number;
      await tx.$queryRaw`SELECT id FROM "Invoice" WHERE "invoiceNumber" = ${invoiceNumber} FOR UPDATE`;
      const depositInvoice = await tx.invoice.findUnique({
        where: { invoiceNumber },
        include: { payments: true },
      });
      if (depositInvoice) {
        const paid = depositInvoice.payments.reduce(
          (sum, p) => sum + Math.round(p.amount.toNumber() * 100),
          0,
        );
        await tx.invoice.update({
          where: { id: depositInvoice.id },
          data: {
            total,
            subtotal: total,
            status: paid >= Math.round(total * 100) ? "PAID" : paid > 0 ? "PARTIALLY_PAID" : "UNPAID",
            items: {
              create: [
                ...items,
                {
                  description: "Apply admission deposit",
                  quantity: -1,
                  unitPrice: depositInvoice.total,
                  amount: depositInvoice.total.neg(),
                },
              ],
            },
          },
        });
      } else
        await tx.invoice.create({
          data: {
            invoiceNumber,
            patientId: admission.patientId,
            dentistId: admission.doctorId,
            createdById: actor.id,
            total,
            subtotal: total,
            status: total === 0 ? "PAID" : "UNPAID",
            items: { create: items },
          },
        });
      await tx.admission.update({
        where: { id },
        data: { status: "DISCHARGED", dischargedAt: now, summary },
      });
      await tx.bed.update({ where: { id: admission.bedId }, data: { status: "CLEANING" } });
    } else if (action === "request") {
      await tx.admission.update({ where: { id }, data: { status: "DISCHARGE_REQUESTED" } });
    } else {
      if (admission.status === "DISCHARGE_REQUESTED") throw new Error("The patient is awaiting discharge.");
      const bedId = identifier.parse(form.get("bedId"));
      const nextBed = await tx.bed.update({
        where: { id: bedId, status: "AVAILABLE" },
        data: { status: "OCCUPIED" },
      });
      await tx.bedStay.updateMany({ where: { admissionId: id, end: null }, data: { end: now } });
      await tx.bedStay.create({
        data: { admissionId: id, bedId, start: now, nightlyRate: nextBed.nightlyRate },
      });
      await tx.admission.update({ where: { id }, data: { bedId, status: "TRANSFERRED" } });
      await tx.bed.update({ where: { id: admission.bedId }, data: { status: "CLEANING" } });
    }
    await tx.activityLog.create({
      data: {
        userId: actor.id,
        entityType: "Admission",
        entityId: id,
        action: action.toUpperCase(),
        metadata: { previousBed: admission.bedId, nextBed: String(form.get("bedId") ?? "") },
      },
    });
  });
  revalidatePath("/admissions");
}
