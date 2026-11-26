"use server";

import {stockContext} from "@/server/pharmacy/stock-context";
import { returnDispensedStock } from "@/server/pharmacy/return-transaction";
import { dispensePrescription } from "@/server/pharmacy/dispense-transaction";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertPermission, requirePermission } from "@/lib/auth/guard";
import { requestBranch } from "@/lib/prisma";
import { prisma } from "@/lib/prisma";

const field = z.string().trim().min(1).max(150);
const price = z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);
const quantity = z.coerce.number().int().positive().max(1000000);

export async function receive(form: FormData) {
  const actor = await requirePermission("pharmacy.manage");
  assertPermission(actor, "pharmacy.view");
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
    await stockContext(tx,actor.id,"RECEIVE",data.lot,data.supplier);
    await tx.supplier.upsert({where:{branchId_name:{branchId:await requestBranch(),name:data.supplier}},create:{name:data.supplier},update:{}});
    const identity = { generic, brand, strength, form: dosageForm };
    const medication = await tx.medication.upsert({
      where: { generic_brand_strength_form: identity },
      create: { ...identity, category },
      update: {},
    });
    const existing = await tx.pharmacyBatch.findUnique({
      where: { branchId_medicationId_lot: { branchId: await requestBranch(), medicationId: medication.id, lot: batch.lot } },
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
  assertPermission(actor, "pharmacy.view");
  const data = z
    .object({ batchId: field, medicineId: field, quantity, verified: z.literal("on") })
    .parse(Object.fromEntries(form));
  await dispensePrescription(data, actor.id);
  revalidatePath("/pharmacy");
  revalidatePath("/billing/invoices");
}

export async function returnStock(form: FormData) {
  const actor = await requirePermission("pharmacy.edit");
  assertPermission(actor, "pharmacy.view");
  const data = z.object({ fillId: field, quantity, reason: field, expectedReturned: z.coerce.number().int().min(0) }).parse(Object.fromEntries(form));
  await returnDispensedStock({ ...data, restock: form.get("restock") === "on" }, actor.id);
  revalidatePath("/pharmacy");
  revalidatePath("/billing/invoices");
}

export async function adjustStock(form: FormData) {
  const actor = await requirePermission("pharmacy.manage");
  assertPermission(actor, "pharmacy.view");
  const data = z.object({ batchId: field, counted: z.coerce.number().int().min(0).max(1000000), expected: z.coerce.number().int().min(0), reason: field }).parse(Object.fromEntries(form));
  await prisma.$transaction(async tx => {
    await stockContext(tx,actor.id,"ADJUST",data.batchId,data.reason);
    await tx.pharmacyBatch.update({ where: { id: data.batchId, quantity: data.expected }, data: { quantity: data.counted } });
    await tx.activityLog.create({ data: { entityType: "PharmacyBatch", entityId: data.batchId, action: "ADJUST", userId: actor.id, description: data.reason, metadata: { previous: data.expected, counted: data.counted } } });
  });
  revalidatePath("/pharmacy");
}

export async function purchaseReturn(form:FormData){
 const actor=await requirePermission('pharmacy.manage');
 const {returnPurchase}=await import('@/server/pharmacy/purchase-return');
 await returnPurchase({batchId:String(form.get('batchId')),quantity:Number(form.get('quantity')),expected:Number(form.get('expected')),reason:String(form.get('reason'))},actor);revalidatePath('/pharmacy');revalidatePath('/pharmacy/ledger');
}
export async function saveSupplier(form:FormData){
 await requirePermission('pharmacy.manage');
 const data=z.object({name:field,phone:z.string().trim().max(100),email:z.union([z.literal(''),z.email()]),address:z.string().trim().max(1000)}).parse(Object.fromEntries(form));
 await prisma.supplier.upsert({where:{branchId_name:{branchId:await requestBranch(),name:data.name}},create:data,update:data});revalidatePath('/pharmacy/ledger');
}
