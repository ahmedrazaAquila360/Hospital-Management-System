import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Internal transaction: the server action authorizes and validates dispensing. */
export async function dispensePrescription(data: { medicineId: string; batchId: string; quantity: number }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PrescriptionMedicine" WHERE id = ${data.medicineId} FOR UPDATE`;
    const previous = await tx.dispensing.findUnique({ where: { medicineId: data.medicineId } });
    if (previous) {
      if (previous.batchId !== data.batchId || previous.quantity !== data.quantity)
        throw new Error("This prescription line was already dispensed with different details.");
      return previous;
    }
    const settings = await tx.clinicSettings.findFirst({ select: { timeZone: true } });
    const today = new Date(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: settings?.timeZone ?? "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date()),
    );
    const rx = await tx.prescriptionMedicine.findUniqueOrThrow({
      where: { id: data.medicineId },
      include: { prescription: true },
    });
    const batch = await tx.pharmacyBatch.update({
      where: {
        id: data.batchId,
        expiry: { gte: today },
        quantity: { gte: data.quantity },
        medication: {
          OR: [
            { generic: { equals: rx.medicineName, mode: "insensitive" } },
            { brand: { equals: rx.medicineName, mode: "insensitive" } },
          ],
        },
      },
      data: { quantity: { decrement: data.quantity } },
      include: { medication: true },
    });
    if (batch.quantity < 10 && batch.quantity + data.quantity >= 10) {
      const recipients = await tx.user.findMany({ where: { status:"ACTIVE", role: { name: { in: ["PHARMACIST","INVENTORY_MANAGER","ADMIN"] } } }, select: { id:true } });
      await tx.notification.createMany({ data: recipients.map(r=>({ userId:r.id,type:"SYSTEM",title:"Low pharmacy stock",message:`${batch.medication.generic} · Lot ${batch.lot} · ${batch.quantity} units remaining`,link:"/pharmacy" })) });
    }
    const total = batch.price.mul(data.quantity);
    const invoice = await tx.invoice.create({
      data: {
        invoiceNumber: `PH-${randomUUID()}`,
        patientId: rx.prescription.patientId,
        dentistId: rx.prescription.dentistId,
        createdById: actorId,
        total,
        subtotal: total,
        status: total.isZero() ? "PAID" : "UNPAID",
        items: {
          create: {
            description: `${batch.medication.brand} ${batch.medication.strength} · ${batch.lot}`,
            quantity: data.quantity,
            unitPrice: batch.price,
            amount: total,
          },
        },
      },
    });
    const fill = await tx.dispensing.create({
      data: { medicineId: rx.id, batchId: batch.id, invoiceId: invoice.id, quantity: data.quantity },
    });
    await tx.activityLog.create({
      data: { userId: actorId, action: "DISPENSE", entityType: "Dispensing", entityId: fill.id },
    });
    return fill;
  });
}
