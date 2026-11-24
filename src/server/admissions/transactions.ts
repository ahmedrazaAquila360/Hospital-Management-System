import "server-only";
import { doctorDepartment } from "@/server/branches/department";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

const identifier = z.string().trim().min(1).max(100);
// Internal services: server actions retain authentication, permission and input checks.

export async function createAdmission(data: { patientCode: string; doctorId: string; bedId: string; diagnosis: string }, requestOnly: boolean, deposit: number, method: PaymentMethod, actorId: string) {
  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findUniqueOrThrow({ where: { patientCode: data.patientCode, archivedAt: null } });
    const doctor = await tx.user.findFirstOrThrow({
      where: { id: data.doctorId, status: "ACTIVE", role: { name: "DENTIST" }, branchMemberships: {some: {active: true}} },
    });
    const department = await doctorDepartment(tx,doctor.id,doctor.departmentId);
    if (!department) throw new Error("Assign the doctor to a department first.");
    const bed = await tx.bed.update({
      where: { id: data.bedId, status: "AVAILABLE" },
      data: { status: requestOnly ? "RESERVED" : "OCCUPIED" },
    });
    const admission = await tx.admission.create({
      data: {
        patientId: patient.id,
        doctorId: doctor.id,
        departmentId: department.id,
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
          createdById: actorId,
          subtotal: deposit,
          total: deposit,
          status: "PAID",
          items: {
            create: { description: "Admission deposit", quantity: 1, unitPrice: deposit, amount: deposit },
          },
          payments: {
            create: {
              patientId: patient.id,
              receivedById: actorId,
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
        userId: actorId,
        action: requestOnly ? "REQUEST" : "ADMIT",
        entityType: "Admission",
        entityId: admission.id,
        metadata: { bedId: data.bedId },
      },
    });
    return admission;
  });
}

export async function changeAdmission(id: string, action: "transfer" | "request" | "discharge" | "confirm" | "cancel" | "activate", form: FormData, actorId: string) {
  return prisma.$transaction(async (tx) => {
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
            createdById: actorId,
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
      if (admission.bedId !== identifier.parse(form.get("expectedBedId"))) throw new Error("Bed assignment changed. Refresh before transferring again.");
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
        userId: actorId,
        entityType: "Admission",
        entityId: id,
        action: action.toUpperCase(),
        metadata: { previousBed: admission.bedId, nextBed: String(form.get("bedId") ?? "") },
      },
    });
  });
}

export async function postAdmissionDeposit(data: { id: string; amount: string; expectedTotal: string; method: PaymentMethod }, actorId: string) {
  const amount = new Prisma.Decimal(data.amount);
  if (!amount.gt(0)) throw new Error("Deposit must be greater than zero.");
  return prisma.$transaction(async tx => {
    // Match discharge's lock order so deposit collection cannot race settlement.
    await tx.$queryRaw`SELECT id FROM "Admission" WHERE id = ${data.id} FOR UPDATE`;
    const admission = await tx.admission.findFirstOrThrow({
      where: { id: data.id, status: { in: ["ADMITTED", "ACTIVE", "TRANSFERRED", "DISCHARGE_REQUESTED"] }, dischargedAt: null },
    });
    const invoiceNumber = "IPD-" + admission.number;
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE "invoiceNumber" = ${invoiceNumber} FOR UPDATE`;
    const existing = await tx.invoice.findUnique({ where: { invoiceNumber }, include: { payments: true } });
    const previous = existing?.total ?? new Prisma.Decimal(0);
    if (!previous.equals(data.expectedTotal)) throw new Error("Deposits changed. Refresh before collecting another payment.");
    const total = previous.plus(amount);
    if (total.gt("99999999.99")) throw new Error("Total deposits exceed the invoice limit.");
    const paid = (existing?.payments ?? []).reduce((sum, p) => sum.plus(p.amount), amount);
    const payment = { patientId: admission.patientId, receivedById: actorId, amount, method: data.method, reference: "Admission deposit" };
    const item = { description: "Admission deposit", quantity: 1, unitPrice: amount, amount };
    const status = paid.gte(total) ? "PAID" : "PARTIALLY_PAID";
    const invoice = existing
      ? await tx.invoice.update({ where: { id: existing.id }, data: { total, subtotal: total, status, items: { create: item }, payments: { create: payment } } })
      : await tx.invoice.create({ data: { invoiceNumber, patientId: admission.patientId, dentistId: admission.doctorId, createdById: actorId, total, subtotal: total, status, items: { create: item }, payments: { create: payment } } });
    await tx.activityLog.create({ data: { userId: actorId, action: "DEPOSIT", entityType: "Admission", entityId: admission.id, metadata: { amount: amount.toFixed(2), invoiceId: invoice.id } } });
  });
}
