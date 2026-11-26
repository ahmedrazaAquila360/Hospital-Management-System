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
const quantity = z.coerce.number().int().positive().max(1000000);

export async function receive(form: FormData) {
  const actor = await requirePermission("pharmacy.manage");
  assertPermission(actor, "pharmacy.view");
  const {receiveStock}=await import("@/server/pharmacy/receive-transaction");
  await receiveStock(Object.fromEntries(form),actor);
  revalidatePath("/pharmacy");
  revalidatePath("/pharmacy/ledger");
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
