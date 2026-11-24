import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import {activeCashierShift} from "./cashier-shift";

/** Internal transaction; the action must authorize billing.refund before calling. */
export async function postInvoiceRefund(data: { invoiceId: string; requestId: string; amount: string; reason: string; method: PaymentMethod }, actorId: string) {
  return prisma.$transaction(tx=>applyInvoiceRefund(tx,data,actorId));
}

export async function applyInvoiceRefund(tx:Prisma.TransactionClient,data: { invoiceId: string; requestId: string; amount: string; reason: string; method: PaymentMethod }, actorId: string) {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${data.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({ where: { id: data.invoiceId }, include: { payments: true } });
    if (!invoice) return { error: "Invoice not found." };
    const amount = new Prisma.Decimal(data.amount).neg();
    const prior = invoice.payments.find(p => p.requestId === data.requestId);
    if (prior) {
      if (!prior.amount.equals(amount) || prior.method !== data.method || prior.reference !== data.reason)
        return { error: "This submission was already used with different details. Reload before recording a new refund." };
      return { patientId: invoice.patientId,paymentId:prior.id };
    }
    const net = invoice.payments.reduce((sum, p) => sum.plus(p.amount), amount);
    if (net.lt(0)) return { error: "Refund exceeds net payments." };
    const cashierShiftId=await activeCashierShift(tx,actorId,false);
    const refund = await tx.payment.create({ data: {
      invoiceId: invoice.id, patientId: invoice.patientId, requestId: data.requestId,
      amount, method: data.method, reference: data.reason, receivedById: actorId,cashierShiftId,
    } });
    await tx.invoice.update({ where: { id: invoice.id }, data: { status: net.gte(invoice.total) ? "PAID" : net.gt(0) ? "PARTIALLY_PAID" : "UNPAID" } });
    await tx.activityLog.create({ data: { userId: actorId, entityType: "Payment", entityId: refund.id, action: "REFUND", description: data.reason } });
    return { patientId: invoice.patientId,paymentId:refund.id };
}
