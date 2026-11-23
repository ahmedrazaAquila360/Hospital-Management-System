import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { dispensePrescription } from "../src/server/pharmacy/dispense-transaction";

async function main() {
  assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS, "1", "Use a dedicated development database and opt in.");
  const tag = `pharmacy-test-${randomUUID()}`;
  const actor = await prisma.user.findFirstOrThrow({ where: { email: "admin@hospital.example" } });
  const patient = await prisma.patient.create({ data: { patientCode: tag, fullName: "Synthetic pharmacy patient", dob: new Date("2000-01-01"), gender: "OTHER", phone: "0000000000" } });
  let medicationId: string | undefined;
  try {
    const medication = await prisma.medication.create({ data: { generic: tag, brand: tag, strength: "Synthetic", form: "Synthetic", category: "Test" } });
    medicationId = medication.id;
    const batch = await prisma.pharmacyBatch.create({ data: { medicationId, lot: tag, expiry: new Date("2099-01-01"), supplier: "Synthetic", purchase: 1, price: 2, quantity: 20 } });
    const prescription = await prisma.prescription.create({ data: { patientId: patient.id, dentistId: actor.id, medicines: { create: Array.from({ length: 6 }, () => ({ medicineName: tag, dosage: "Synthetic", frequency: "Synthetic", duration: "Synthetic" })) } }, include: { medicines: true } });
    const request = { medicineId: prescription.medicines[0].id, batchId: batch.id, quantity: 2 };
    const retries = await Promise.all(Array.from({ length: 8 }, () => dispensePrescription(request, actor.id)));
    assert.equal(new Set(retries.map(fill => fill.id)).size, 1);
    assert.equal(await prisma.invoice.count({ where: { patientId: patient.id } }), 1);
    assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: batch.id } })).quantity, 18);
    assert.equal(await prisma.activityLog.count({ where: { entityId: retries[0].id, action: "DISPENSE" } }), 1);
    await assert.rejects(dispensePrescription({ ...request, quantity: 3 }, actor.id), /already dispensed/);
    const races = await Promise.allSettled([1, 2].map(i => dispensePrescription({ ...request, medicineId: prescription.medicines[i].id, quantity: 12 }, actor.id)));
    assert.equal(races.filter(r => r.status === "fulfilled").length, 1);
    assert.ok(races.some(r => r.status === "rejected" && r.reason.code === "P2025"));
    assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: batch.id } })).quantity, 6);
    assert.equal(await prisma.invoice.count({ where: { patientId: patient.id } }), 2);
    console.log("Concurrent fills: repeated prescription creates one fill/invoice; competing prescriptions cannot oversell.");

    const expired = await prisma.pharmacyBatch.create({ data: { medicationId, lot: tag + "-expired", expiry: new Date("2000-01-01"), supplier: "Synthetic", purchase: 1, price: 2, quantity: 10 } });
    await assert.rejects(dispensePrescription({ medicineId: prescription.medicines[3].id, batchId: expired.id, quantity: 1 }, actor.id), { code: "P2025" });
    await prisma.prescriptionMedicine.update({ where: { id: prescription.medicines[4].id }, data: { medicineName: "Different synthetic medicine" } });
    await assert.rejects(dispensePrescription({ ...request, medicineId: prescription.medicines[4].id }, actor.id), { code: "P2025" });
    // Invalid actor forces invoice creation to fail after stock was deducted.
    await assert.rejects(dispensePrescription({ ...request, medicineId: prescription.medicines[5].id }, "nonexistent-test-actor"), { code: "P2003" });
    assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: batch.id } })).quantity, 6);
    assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({ where: { id: expired.id } })).quantity, 10);
    assert.equal(await prisma.invoice.count({ where: { patientId: patient.id } }), 2);
    assert.equal(await prisma.dispensing.count({ where: { medicine: { prescriptionId: prescription.id } } }), 2);
    const invoices = await prisma.invoice.findMany({ where: { patientId: patient.id }, include: { items: true } });
    assert.equal(invoices.reduce((sum, i) => sum + Number(i.total), 0), 28);
    for (const invoice of invoices) assert.equal(invoice.total.toString(), invoice.items[0].amount.toString());
    console.log("Expired/wrong medicine rejected; invoice failure rolls stock back; only successful fills create charges.");
  } finally {
    const fills = await prisma.dispensing.findMany({ where: { medicine: { prescription: { patientId: patient.id } } }, select: { id: true } });
    await prisma.activityLog.deleteMany({ where: { entityId: { in: fills.map(f => f.id) } } });
    await prisma.notification.deleteMany({ where: { link: "/pharmacy", message: { contains: tag } } });
    await prisma.dispensing.deleteMany({ where: { id: { in: fills.map(f => f.id) } } });
    await prisma.invoice.deleteMany({ where: { patientId: patient.id } });
    await prisma.prescription.deleteMany({ where: { patientId: patient.id } });
    if (medicationId) {
      await prisma.pharmacyBatch.deleteMany({ where: { medicationId } });
      await prisma.medication.delete({ where: { id: medicationId } });
    }
    await prisma.patient.delete({ where: { id: patient.id } });
  }
}
main().finally(() => prisma.$disconnect());
