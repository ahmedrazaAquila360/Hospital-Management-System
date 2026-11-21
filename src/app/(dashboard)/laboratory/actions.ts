"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { LabStatus } from "@/generated/prisma/enums";
import { requirePermission, assertPermission } from "@/lib/auth/guard";
import { encounterScope } from "@/server/encounters/scope";
import { prisma } from "@/lib/prisma";
import { invoiceService } from "@/server/billing/service-charge";
import { labTransitions } from "./workflow";

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
  const status = z.enum(LabStatus).parse(form.get("status"));
  const approval = status === "VERIFIED" || status === "RELEASED";
  const user = await requirePermission(approval ? "lab.approve" : "lab.edit");
  assertPermission(user, "lab.view");
  const id = z.string().min(1).parse(form.get("id"));
  await prisma.$transaction(async (tx) => {
    const order = await tx.labOrder.findUniqueOrThrow({
      where: { id },
      include: { encounter: { include: { admission: true, appointment: true } }, test: true },
    });
    if (!labTransitions[order.status].includes(status))
      throw new Error("Refresh the order to see its current status.");
    if (status === "VERIFIED" && order.enteredBy === user.id)
      throw new Error("Verification requires a second staff member.");
    await tx.labOrder.update({
      where: { id, status: order.status },
      data: {
        status,
        ...(status === "SAMPLE_COLLECTED" && {
          sampleId: z.string().trim().min(1).max(100).parse(form.get("sampleId")),
          collectedAt: new Date(),
        }),
        ...(status === "COMPLETED" && {
          result: z.string().trim().min(1).max(4000).parse(form.get("result")),
          abnormal: form.get("abnormal") === "on",
          enteredBy: user.id,
        }),
        ...(status === "VERIFIED" && { verifiedBy: user.id }),
        ...(status === "RELEASED" && { releasedAt: new Date() }),
      },
    });
    if (status === "RELEASED") {
      const patientId = order.encounter.appointment?.patientId ?? order.encounter.admission?.patientId;
      const doctorId = order.encounter.appointment?.dentistId ?? order.encounter.admission?.doctorId;
      if (!patientId || !doctorId) throw new Error("Missing ordering encounter.");
      await invoiceService(tx, "LAB-" + id, patientId, doctorId, user.id, order.test.name, order.price);
      await tx.notification.create({
        data: {
          userId: doctorId,
          title: "Laboratory report released",
          message: order.test.name,
          type: "SYSTEM",
          link: `/opd?visit=${order.encounterId}`,
        },
      });
    }
    await tx.activityLog.create({
      data: { action: status, entityType: "LabOrder", entityId: id, userId: user.id },
    });
  });
  revalidatePath("/opd");
  revalidatePath("/laboratory");
}
