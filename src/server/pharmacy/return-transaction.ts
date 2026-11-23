import "server-only";
import { prisma } from "@/lib/prisma";

/** Internal transaction: caller authorizes pharmacy.edit and validates input. */
export async function returnDispensedStock(data: { fillId: string; quantity: number; reason: string; expectedReturned: number; restock: boolean }, actorId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Dispensing" WHERE id = ${data.fillId} FOR UPDATE`;
    const fill = await tx.dispensing.findUniqueOrThrow({
      where: { id: data.fillId },
      include: { batch: true },
    });
    if (fill.returned !== data.expectedReturned) throw new Error("Returns changed. Refresh before recording another return.");
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
    const restock = data.restock;
    if (restock)
      await tx.pharmacyBatch.update({
        where: { id: fill.batchId },
        data: { quantity: { increment: data.quantity } },
      });
    await tx.activityLog.create({
      data: {
        userId: actorId,
        action: "RETURN",
        entityType: "Dispensing",
        entityId: fill.id,
        description: data.reason,
        metadata: { quantity: data.quantity, restock },
      },
    });
  });
}
