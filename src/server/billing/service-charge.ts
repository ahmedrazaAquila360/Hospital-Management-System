import type { Prisma } from "@/generated/prisma/client";

export async function invoiceService(
  tx: Prisma.TransactionClient,
  source: string,
  patientId: string,
  doctorId: string,
  staffId: string,
  description: string,
  price: Prisma.Decimal,
  quantity = 1,
) {
  const total = price.mul(quantity);
  return tx.invoice.upsert({
    where: { invoiceNumber: source },
    update: {},
    create: {
      invoiceNumber: source,
      patientId,
      dentistId: doctorId,
      createdById: staffId,
      total,
      subtotal: total,
      status: total.isZero() ? "PAID" : "UNPAID",
      items: { create: { description, unitPrice: price, amount: total, quantity } },
    },
  });
}
