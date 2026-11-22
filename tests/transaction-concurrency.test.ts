import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { postInvoicePayment } from "../src/server/billing/payment-transaction";

async function main() {
  assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS, "1", "Opt in against a dedicated development database.");
  const tag = `concurrency-${randomUUID()}`;
  const actor = await prisma.user.findFirstOrThrow({ where: { email: "admin@hospital.example" }, select: { id: true, name: true } });
  const patient = await prisma.patient.create({ data: { patientCode: tag, fullName: "Synthetic concurrency patient", dob: new Date("2000-01-01"), gender: "OTHER", phone: "0000000000" } });
  const invoiceIds: string[] = [];
  let bedId: string | undefined;
  let medicationId: string | undefined;
  try {
    const invoice = await prisma.invoice.create({ data: { invoiceNumber: tag, patientId: patient.id, subtotal: 100, total: 100, createdById: actor.id } });
    invoiceIds.push(invoice.id);
    const request = { invoiceId: invoice.id, amount: 20, method: "CASH" as const, requestId: randomUUID(), reference: "Synthetic retry test" };
    const retries = await Promise.all(Array.from({ length: 8 }, () => postInvoicePayment(request, actor)));
    assert.ok(retries.every(r => !!r.invoice));
    assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 1);
    assert.equal(await prisma.activityLog.count({ where: { entityId: invoice.id, action: "PAYMENT" } }), 1);
    assert.equal(await prisma.notification.count({ where: { link: `/billing/invoices/${invoice.id}` } }), 1);
    const changed = await postInvoicePayment({ ...request, amount: 21 }, actor);
    assert.ok(changed.error);
    const competing = await Promise.all(Array.from({ length: 2 }, () => postInvoicePayment({ ...request, amount: 60, requestId: randomUUID() }, actor)));
    assert.equal(competing.filter(r => !!r.invoice).length, 1);
    assert.equal(competing.filter(r => !!r.error).length, 1);
    const paid = await prisma.payment.aggregate({ where: { invoiceId: invoice.id }, _sum: { amount: true } });
    assert.equal(paid._sum.amount?.toString(), "80");
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).status, "PARTIALLY_PAID");
    console.log("Payment transaction: eight retries create one payment/audit/notification; competing collections cannot overpay.");

    // Exercise the same conditional database writes used in admission and dispensing.
    const bed = await prisma.bed.create({ data: { ward: tag, room: "Test", label: "1", category: "Synthetic" } });
    bedId = bed.id;
    const allocations = await Promise.allSettled(Array.from({ length: 2 }, () => prisma.bed.update({ where: { id: bed.id, status: "AVAILABLE" }, data: { status: "OCCUPIED" } })));
    assert.equal(allocations.filter(r => r.status === "fulfilled").length, 1);
    assert.ok(allocations.some(r => r.status === "rejected" && r.reason.code === "P2025"));
    const medication = await prisma.medication.create({ data: { generic: tag, brand: tag, strength: "Synthetic", form: "Synthetic", category: "Test" } });
    medicationId = medication.id;
    const batch = await prisma.pharmacyBatch.create({ data: { medicationId: medication.id, lot: tag, expiry: new Date("2099-01-01"), supplier: "Synthetic", purchase: 1, price: 1, quantity: 5 } });
    const deductions = await Promise.allSettled(Array.from({ length: 2 }, () => prisma.pharmacyBatch.update({ where: { id: batch.id, quantity: { gte: 4 } }, data: { quantity: { decrement: 4 } } })));
    assert.equal(deductions.filter(r => r.status === "fulfilled").length, 1);
    assert.ok(deductions.some(r => r.status === "rejected" && r.reason.code === "P2025"));
    assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: batch.id } })).quantity, 1);
    console.log("Database guards: one competing bed allocation and one stock deduction succeed; stock stays nonnegative.");
  } finally {
    await prisma.notification.deleteMany({ where: { link: { in: invoiceIds.map(id => `/billing/invoices/${id}`) } } });
    await prisma.activityLog.deleteMany({ where: { entityId: { in: invoiceIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    if (bedId) await prisma.bed.delete({ where: { id: bedId } });
    if (medicationId) {
      await prisma.pharmacyBatch.deleteMany({ where: { medicationId } });
      await prisma.medication.delete({ where: { id: medicationId } });
    }
    await prisma.patient.delete({ where: { id: patient.id } });
  }
}
main().finally(() => prisma.$disconnect());
