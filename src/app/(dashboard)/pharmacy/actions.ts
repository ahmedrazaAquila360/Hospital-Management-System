"use server";

import { dispensePrescription } from "@/server/pharmacy/dispense-transaction";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

const field = z.string().trim().min(1).max(150);
const price = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);
const quantity = z.coerce.number().int().positive().max(1000000);

export async function receive(form: FormData) {
  const actor = await requirePermission("pharmacy.manage");
  const data = z
    .object({
      generic: field,
      brand: field,
      strength: field,
      form: field,
      category: field,
      lot: field,
      supplier: field,
      expiry: z.iso.date(),
      price,
      purchase: price,
      quantity,
    })
    .parse(Object.fromEntries(form));
  const { generic, brand, strength, form: dosageForm, category, expiry, ...batch } = data;
  await prisma.$transaction(async (tx) => {
    const identity = { generic, brand, strength, form: dosageForm };
    const medication = await tx.medication.upsert({
      where: { generic_brand_strength_form: identity },
      create: { ...identity, category },
      update: {},
    });
    const existing = await tx.pharmacyBatch.findUnique({
      where: { medicationId_lot: { medicationId: medication.id, lot: batch.lot } },
    });
    if (
      existing &&
      (existing.expiry.toISOString().slice(0, 10) !== expiry ||
        !existing.price.equals(batch.price) ||
        !existing.purchase.equals(batch.purchase) ||
        existing.supplier !== batch.supplier)
    )
      throw new Error("Batch details differ from the existing lot.");
    const receipt = existing
      ? await tx.pharmacyBatch.update({
          where: { id: existing.id },
          data: { quantity: { increment: batch.quantity } },
        })
      : await tx.pharmacyBatch.create({
          data: { ...batch, medicationId: medication.id, expiry: new Date(expiry) },
        });
    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "RECEIVE",
        entityType: "PharmacyBatch",
        entityId: receipt.id,
        metadata: { quantity: batch.quantity },
      },
    });
  });
  revalidatePath("/pharmacy");
}

export async function dispense(form: FormData) {
  const actor = await requirePermission("pharmacy.edit");
  const data = z
    .object({ batchId: field, medicineId: field, quantity, verified: z.literal("on") })
    .parse(Object.fromEntries(form));
  await dispensePrescription(data, actor.id);
  revalidatePath("/pharmacy");
  revalidatePath("/billing/invoices");
}

export async function returnStock(form: FormData) {
  const actor = await requirePermission("pharmacy.edit");
  const data = z.object({ fillId: field, quantity, reason: field }).parse(Object.fromEntries(form));
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Dispensing" WHERE id = ${data.fillId} FOR UPDATE`;
    const fill = await tx.dispensing.findUniqueOrThrow({
      where: { id: data.fillId },
      include: { batch: true },
    });
    if (data.quantity > fill.quantity - fill.returned)
      throw new Error("Return exceeds the dispensed quantity.");
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${fill.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUniqueOrThrow({
      where: { id: fill.invoiceId },
      include: { payments: true, items: true },
    });
    const original = invoice.items.find((i) => i.quantity > 0);
    if (!original) throw new Error("Missing sale line.");
    const credit = original.unitPrice.mul(data.quantity);
    const total = invoice.total.minus(credit);
    const paid = invoice.payments.reduce((sum, p) => sum.plus(p.amount), total.mul(0));
    await tx.invoice.update({
      where: { id: invoice.id },
      data: {
        total,
        subtotal: { decrement: credit },
        status: paid.gte(total) ? "PAID" : paid.gt(0) ? "PARTIALLY_PAID" : "UNPAID",
        items: {
          create: {
            description: "Medicine return · " + data.reason,
            quantity: -data.quantity,
            unitPrice: original.unitPrice,
            amount: credit.neg(),
          },
        },
      },
    });
    await tx.dispensing.update({ where: { id: fill.id }, data: { returned: { increment: data.quantity } } });
    const restock = form.get("restock") === "on";
    if (restock)
      await tx.pharmacyBatch.update({
        where: { id: fill.batchId },
        data: { quantity: { increment: data.quantity } },
      });
    await tx.activityLog.create({
      data: {
        userId: actor.id,
        action: "RETURN",
        entityType: "Dispensing",
        entityId: fill.id,
        description: data.reason,
        metadata: { quantity: data.quantity, restock },
      },
    });
  });
  revalidatePath("/pharmacy");
  revalidatePath("/billing/invoices");
}

export async function adjustStock(form: FormData) {
  const actor = await requirePermission("pharmacy.manage");
  const data = z.object({ batchId: field, counted: z.coerce.number().int().min(0).max(1000000), expected: z.coerce.number().int().min(0), reason: field }).parse(Object.fromEntries(form));
  await prisma.$transaction(async tx => {
    await tx.pharmacyBatch.update({ where: { id: data.batchId, quantity: data.expected }, data: { quantity: data.counted } });
    await tx.activityLog.create({ data: { entityType: "PharmacyBatch", entityId: data.batchId, action: "ADJUST", userId: actor.id, description: data.reason, metadata: { previous: data.expected, counted: data.counted } } });
  });
  revalidatePath("/pharmacy");
}
