import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { toNumber } from "@/lib/format";
import type { InvoiceStatus } from "@/generated/prisma/enums";

const billingPatient = { id: true, patientCode: true, fullName: true, email: true, phone: true, address: true } as const;

export const INVOICES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type InvoiceFilters = { search?: string; status?: InvoiceStatus; patientId?: string; page?: number; pageSize?: number };

export async function listInvoices(filters: InvoiceFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = {
    AND: [
      filters.search
        ? {
            OR: [
              { invoiceNumber: { contains: filters.search, mode: "insensitive" as const } },
              { patient: { fullName: { contains: filters.search, mode: "insensitive" as const } } },
            ],
          }
        : {},
      filters.status ? { status: filters.status } : {},
      filters.patientId ? { patientId: filters.patientId } : {},
    ],
  };

  const [total, invoices] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: { select: billingPatient }, payments: true },
    }),
  ]);

  return { invoices, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getInvoiceById(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    include: {
      patient: { select: billingPatient },
      dentist: true,
      createdBy: true,
      items: { include: { treatment: { select: { id: true, name: true } } } },
      payments: { orderBy: { date: "desc" }, include: { receivedBy: true } },
    },
  });
}

export async function generateInvoiceNumber() {
  const [row] = await prisma.$queryRaw<{ value: bigint }[]>`SELECT nextval('hospital_invoice_number') AS value`;
  return "HINV-" + String(row.value).padStart(7,"0");
}

export const PAYMENTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export async function listPayments(filters: { search?: string; page?: number; pageSize?: number }) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = filters.search
    ? {
        OR: [
          { patient: { fullName: { contains: filters.search, mode: "insensitive" as const } } },
          { invoice: { invoiceNumber: { contains: filters.search, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: { select: billingPatient }, invoice: true, receivedBy: true },
    }),
  ]);

  return { payments, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export function invoicePaidAmount(invoice: { payments: { amount: unknown }[] }) {
  return invoice.payments.reduce((sum, p) => sum + toNumber(p.amount), 0);
}

/** Read-only totals for the Invoices summary cards (all invoices, not just the current page). */
export async function getInvoiceStats() {
  const [count, billed, paid] = await Promise.all([
    prisma.invoice.count(),
    prisma.invoice.aggregate({ _sum: { total: true } }),
    prisma.payment.aggregate({ _sum: { amount: true } }),
  ]);
  const totalBilled = toNumber(billed._sum.total);
  const totalPaid = toNumber(paid._sum.amount);
  return { count, totalBilled, totalPaid, outstanding: Math.max(0, totalBilled - totalPaid) };
}

/** Read-only totals for the Payments summary cards, with a per-method breakdown. */
export async function getPaymentStats() {
  const [all, byMethod] = await Promise.all([
    prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["method"], _sum: { amount: true }, _count: { _all: true } }),
  ]);
  return {
    total: toNumber(all._sum.amount),
    count: all._count._all,
    byMethod: byMethod
      .map((m) => ({ method: m.method, amount: toNumber(m._sum.amount), count: m._count._all }))
      .sort((a, b) => b.amount - a.amount),
  };
}
