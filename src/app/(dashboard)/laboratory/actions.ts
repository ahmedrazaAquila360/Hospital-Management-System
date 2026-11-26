"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LabStatus } from "@/generated/prisma/enums";
import { requirePermission, assertPermission } from "@/lib/auth/guard";
import { encounterScope } from "@/server/encounters/scope";
import { prisma } from "@/lib/prisma";

export async function addTest(form: FormData) {
  await requirePermission("lab.manage");
  const data = z
    .object({
      name: z.string().trim().min(1).max(150),
      category: z.string().trim().min(1).max(100),
      price: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
      referenceRange: z.string().trim().max(300),
    })
    .parse(Object.fromEntries(form));
  await prisma.labTest.create({ data });
  revalidatePath("/laboratory");
}

export async function orderTest(form: FormData) {
  const doctor = await requirePermission("lab.create");
  assertPermission(doctor, "opd.view");
  const encounterId = z.string().min(1).parse(form.get("encounterId"));
  const testId = z.string().min(1).parse(form.get("testId"));
  await prisma.$transaction(async (tx) => {
    await tx.encounter.findFirstOrThrow({
      where: { id: encounterId, ...encounterScope(doctor, undefined, true) },
    });
    const test = await tx.labTest.findUniqueOrThrow({ where: { id: testId } });
    const order = await tx.labOrder.create({
      data: { encounterId, testId, price: test.price, referenceRange: test.referenceRange },
    });
    await tx.activityLog.create({
      data: { action: "ORDER", entityType: "LabOrder", entityId: order.id, userId: doctor.id },
    });
  });
  revalidatePath("/opd");
  revalidatePath("/laboratory");
}

export async function advanceTest(form: FormData) {
 const status=z.enum(LabStatus).parse(form.get("status"));
 const actor=await requirePermission(status==="VERIFIED"||status==="RELEASED"?"lab.approve":"lab.edit");
 const {advanceLabOrder}=await import("@/server/laboratory-workflow");
 await advanceLabOrder(form,actor);revalidatePath("/opd");revalidatePath("/laboratory");
}
