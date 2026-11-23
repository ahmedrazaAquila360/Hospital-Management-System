"use server";

import { z } from "zod";
import { postInvoiceRefund } from "./refund-transaction";
import { postInvoicePayment } from "./payment-transaction";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/guard";
import { invoiceSchema, paymentSchema } from "@/lib/validations/invoice";
import { generateInvoiceNumber } from "@/server/billing/queries";
import { can } from "@/lib/permissions";

export type InvoiceFormState = { error?: string };
export type PaymentFormState = { error?: string; success?: boolean };

function money(n: number) {
  return n.toFixed(2);
}

export async function createInvoiceAction(_prev: InvoiceFormState, formData: FormData): Promise<InvoiceFormState> {
  const user = await requireUser();
  // The New Invoice page is only reachable with billing.manage; enforce it here too.
  if (!can(user, "billing.create")) return { error: "You don't have permission to create invoices." };

  const descriptions = formData.getAll("itemDescription") as string[];
  const quantities = formData.getAll("itemQuantity") as string[];
  const unitPrices = formData.getAll("itemUnitPrice") as string[];
  const treatmentIds = formData.getAll("itemTreatmentId") as string[];

  const items = descriptions
    .map((description, i) => ({
      description,
      quantity: Number(quantities[i] ?? 1),
      unitPrice: Number(unitPrices[i] ?? 0),
      treatmentId: treatmentIds[i] || undefined,
    }))
    .filter((item) => item.description.trim().length > 0);

  const parsed = invoiceSchema.safeParse({
    patientId: formData.get("patientId"),
    dentistId: formData.get("dentistId") || undefined,
    discount: formData.get("discount") || 0,
    tax: formData.get("tax") || 0,
    notes: formData.get("notes") ?? "",
    items,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please fix the highlighted fields." };
  const data = parsed.data;

  const subtotal = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  if (data.discount && !can(user,"billing.discount")) return { error: "Discount authorization required." };
  if (data.discount > subtotal) return { error: "Discount exceeds the subtotal." };
  const total = Math.max(0, subtotal - data.discount + data.tax);
  const invoiceNumber = await generateInvoiceNumber();

  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      patientId: data.patientId,
      dentistId: data.dentistId || null,
      subtotal: money(subtotal),
      discount: money(data.discount),
      tax: money(data.tax),
      total: money(total),
      status: "UNPAID",
      notes: data.notes || null,
      createdById: user.id,
      items: {
        create: data.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: money(item.unitPrice),
          amount: money(item.quantity * item.unitPrice),
          treatmentId: item.treatmentId || null,
        })),
      },
    },
    include: { patient: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "CREATE",
      entityType: "Invoice",
      entityId: invoice.id,
      description: `${user.name} created invoice ${invoice.invoiceNumber} for ${invoice.patient.fullName}.`,
    },
  });

  revalidatePath("/billing/invoices");
  revalidatePath(`/patients/${data.patientId}`);
  redirect(`/billing/invoices/${invoice.id}`);
}

export async function recordPaymentAction(_prev: PaymentFormState, formData: FormData): Promise<PaymentFormState> {
  const user = await requireUser();
  if (!can(user, "billing.payments")) return { error: "You don't have permission to record payments." };

  const parsed = paymentSchema.safeParse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please fix the highlighted fields." };
  const data = parsed.data;
  const request = z.uuid().safeParse(formData.get("requestId"));
  if (!request.success) return { error: "Reopen the payment form before submitting." };

  const result = await postInvoicePayment({ ...data, requestId: request.data }, user);
  if (!result.invoice) return { error: result.error };
  const { invoice } = result;

  revalidatePath("/billing/invoices");
  revalidatePath(`/billing/invoices/${invoice.id}`);
  revalidatePath("/billing/payments");
  revalidatePath(`/patients/${invoice.patientId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function refundPayment(form: FormData): Promise<PaymentFormState> {
  const actor = await requireUser();
  if (!can(actor, "billing.refund")) return { error: "Refund permission required." };
  const parsed = z.object({
    invoiceId: z.string().min(1), requestId: z.uuid(),
    reason: z.string().trim().min(1, "Enter a refund reason.").max(250),
    amount: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).refine(value => Number(value) > 0, "Enter a positive refund amount."),
    method: paymentSchema.shape.method,
  }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the refund details." };
  const result = await postInvoiceRefund(parsed.data, actor.id);
  if (!result.patientId) return { error: result.error };
  revalidatePath("/billing/invoices/" + parsed.data.invoiceId);
  revalidatePath("/billing/invoices");
  revalidatePath("/billing/payments");
  revalidatePath("/patients/" + result.patientId);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
  return { success: true };
}
