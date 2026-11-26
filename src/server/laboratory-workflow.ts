import "server-only";
import {z} from "zod";
import {LabStatus} from "@/generated/prisma/enums";
import {encounterScope} from "@/server/encounters/scope";
import {can,type SessionUser} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {invoiceService} from "@/server/billing/service-charge";
import {labTransitions} from "@/app/(dashboard)/laboratory/workflow";
export async function advanceLabOrder(form: FormData, user: SessionUser) {
  const status = z.enum(LabStatus).parse(form.get("status"));
  const approval = status === "VERIFIED" || status === "RELEASED";
  if (!can(user, approval ? "lab.approve" : "lab.edit") || !can(user,"lab.view")) throw new Error("Laboratory permission required.");
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
}


export async function orderLabTest(form:FormData,doctor:SessionUser){
 if(!can(doctor,"lab.create")||!can(doctor,"opd.view"))throw new Error("Laboratory order permission required.");
  const encounterId = z.string().min(1).parse(form.get("encounterId"));
  const testId = z.string().min(1).parse(form.get("testId"));
  return prisma.$transaction(async (tx) => {
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
    return order;
  });
}
