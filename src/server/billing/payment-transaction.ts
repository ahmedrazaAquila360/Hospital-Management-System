import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { formatCurrency } from "@/lib/format";
import type { PaymentInput } from "@/lib/validations/invoice";
import {activeCashierShift} from "./cashier-shift";

/** Internal transaction; callers must authenticate and authorize payment collection. */
export async function postInvoicePayment(data: PaymentInput & { requestId: string }, user: { id: string; name: string; role?: {name:string} }) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id = ${data.invoiceId} FOR UPDATE`;
    const invoice = await tx.invoice.findUnique({
      where: { id: data.invoiceId },
      include: { payments: true, patient: true },
    });
    if (!invoice) return { error: "Invoice not found." };
    if (invoice.voidedAt) return {error:"This invoice has been voided."};

    const amount = new Prisma.Decimal(data.amount);
    const prior = invoice.payments.find(p => p.requestId === data.requestId);
    if (prior) {
      if (!prior.amount.equals(amount) || prior.method !== data.method || (prior.reference ?? "") !== (data.reference ?? ""))
        return { error: "This payment submission was already used with different details. Reopen the payment form." };
      return { invoice };
    }
    const alreadyPaid = invoice.payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    const remaining = invoice.total.minus(alreadyPaid);
    if (amount.gt(remaining)) return { error: `Amount exceeds the remaining balance of ${remaining.toFixed(2)}.` };
    const cashierShiftId=await activeCashierShift(tx,user.id,user.role?.name==="CASHIER");

    await tx.payment.create({
      data: {
        invoiceId: data.invoiceId,
        patientId: invoice.patientId,
        amount,
        requestId: data.requestId,
        method: data.method,
        reference: data.reference || null,
        receivedById: user.id,
        cashierShiftId,
      },
    });

    const newPaid = alreadyPaid.plus(amount);
    const newStatus = newPaid.gte(invoice.total) ? "PAID" : "PARTIALLY_PAID";

    await tx.invoice.update({ where: { id: data.invoiceId }, data: { status: newStatus } });

    const currency=(await tx.clinicSettings.findFirst({select:{currency:true}}))?.currency??"USD";
    await tx.notification.create({
      data: {
        userId: invoice.createdById ?? user.id,
        type: "PAYMENT_RECEIVED",
        title: "Payment received",
        message: `${formatCurrency(data.amount,currency)} received from ${invoice.patient.fullName} for ${invoice.invoiceNumber}.`,
        link: `/billing/invoices/${invoice.id}`,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "PAYMENT",
        entityType: "Invoice",
        entityId: invoice.id,
        description: `${user.name} recorded a ${formatCurrency(data.amount,currency)} payment for ${invoice.invoiceNumber}.`,
      },
    });
    return { invoice };
  });
}
