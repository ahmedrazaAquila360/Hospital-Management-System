import { z } from "zod";

export const invoiceItemSchema = z.object({
  description: z.string().min(1, "Description is required"),
  quantity: z.coerce.number().int().min(1).max(1000000),
  unitPrice: z.coerce.number().min(0).max(99999999.99).multipleOf(0.01),
  treatmentId: z.string().optional(),
});

export const invoiceSchema = z.object({
  patientId: z.string().min(1, "Select a patient"),
  dentistId: z.string().optional(),
  discount: z.coerce.number().min(0).max(99999999.99).multipleOf(0.01).default(0),
  tax: z.coerce.number().min(0).max(99999999.99).multipleOf(0.01).default(0),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1, "Add at least one line item"),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;

export const PAYMENT_METHODS = ["CASH", "CARD", "BANK_TRANSFER", "INSURANCE", "OTHER"] as const;

export const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be greater than 0").multipleOf(0.01),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
