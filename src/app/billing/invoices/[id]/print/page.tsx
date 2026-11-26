import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getInvoiceById, invoicePaidAmount } from "@/server/billing/queries";
import { getClinicSettings } from "@/server/settings/queries";
import { PrintButton } from "@/components/print/print-button";
import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand/brand-logo";
import { INVOICE_STATUS_STYLE } from "@/components/billing/invoice-status";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/format";
import { INVOICE_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Print Invoice" };

/**
 * A4 invoice for printing / "Save as PDF". Uses no <header> element: the app's print CSS
 * hides headers (the dashboard top bar), which would remove the clinic block on paper.
 */
export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("billing.view");
  const { id } = await params;
  const [invoice, clinic] = await Promise.all([getInvoiceById(id), getClinicSettings()]);
  if (!invoice) notFound();

  const total = toNumber(invoice.total);
  const paid = invoicePaidAmount(invoice);
  const remaining = invoice.voidedAt ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100);
  const contact = [clinic.phone, clinic.email, clinic.website].filter(Boolean).join("  ·  ");

  return (
    <div className="min-h-svh bg-slate-100 py-8 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4 print:hidden">
        <Button asChild variant="outline">
          <a href={`/api/invoices/${invoice.id}/pdf`} download={`${invoice.invoiceNumber}.pdf`}>
            <Download /> Download PDF
          </a>
        </Button>
        <PrintButton />
      </div>

      <article className="relative mx-auto flex min-h-[297mm] w-full max-w-[210mm] flex-col overflow-hidden bg-white px-[14mm] py-[14mm] text-slate-900 shadow-xl print:min-h-0 print:shadow-none">
        {/* Brand + title */}
        <div className="flex items-start justify-between gap-6 border-b border-[#cfdcea] pb-6">
          <div className="flex items-center gap-3">
            {clinic.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="" className="size-14 rounded-xl object-contain" />
            ) : (
              <BrandMark className="size-14" />
            )}
            <div>
              <p className="text-2xl leading-tight font-bold text-[#073b7a]">{clinic.clinicName}</p>
              {clinic.address && <p className="text-sm text-slate-500">{clinic.address}</p>}
              {contact && <p className="text-xs text-slate-500">{contact}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-4xl font-extrabold tracking-tight text-[#0b2a55]">{invoice.voidedAt ? "VOIDED INVOICE" : "INVOICE"}</p>
            <span
              className={cn(
                "mt-2 inline-block rounded-full px-3.5 py-1 text-sm font-semibold ring-1 ring-inset",
                INVOICE_STATUS_STYLE[invoice.voidedAt ? "VOIDED" : invoice.status] ?? INVOICE_STATUS_STYLE.UNPAID
              )}
            >
              {invoice.voidedAt ? "Voided" : INVOICE_STATUS_LABEL[invoice.status] ?? invoice.status}
            </span>
          </div>
        </div>
        {invoice.voidedAt && <p className="mt-4 rounded-lg border border-slate-300 bg-slate-100 p-3 font-semibold">VOIDED · {formatDateTime(invoice.voidedAt)} · {invoice.voidReason}</p>}

        {/* Number / dates */}
        <div className="mt-6 grid grid-cols-3 divide-x divide-[#dbe6f1]">
          <Meta label="Invoice #">
            <span className="text-2xl font-bold text-[#0b2a55]">{invoice.invoiceNumber}</span>
          </Meta>
          <Meta label="Invoice Date">{formatDate(invoice.date)}</Meta>
          <Meta label="Patient ID">{invoice.patient.patientCode}</Meta>
        </div>

        {/* People */}
        <div className="mt-6 grid grid-cols-2 divide-x divide-[#dbe6f1] rounded-2xl border border-[#dbe6f1] bg-[#f6faff] px-6 py-5">
          <div className="pr-6">
            <p className="text-sm text-slate-500">Patient</p>
            <p className="text-xl font-bold text-[#0b2a55]">{invoice.patient.fullName}</p>
            <p className="text-xs text-slate-500">
              {invoice.patient.phone}
              {invoice.patient.email ? `  ·  ${invoice.patient.email}` : ""}
            </p>
          </div>
          <div className="pl-6">
            <p className="text-sm text-slate-500">Dentist</p>
            <p className="text-xl font-bold text-[#0b2a55]">{invoice.dentist?.name ?? "—"}</p>
          </div>
        </div>

        {/* Items + summary */}
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)_70mm] items-start gap-6">
          <div className="break-inside-avoid">
            <p className="mb-3 text-xl font-bold text-[#0b2a55]">Line Items</p>
            <table className="w-full overflow-hidden rounded-xl border border-[#dbe6f1] text-sm">
              <thead>
                <tr className="bg-[#e8f1fb] text-left text-[#0b2a55]">
                  <th className="px-3 py-2.5 font-semibold">#</th>
                  <th className="px-3 py-2.5 font-semibold">Description</th>
                  <th className="px-3 py-2.5 text-center font-semibold">Qty</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Unit Price</th>
                  <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, i) => (
                  <tr key={item.id} className="border-t border-[#e6edf5]">
                    <td className="px-3 py-3 text-slate-500 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-3">{item.description}</td>
                    <td className="px-3 py-3 text-center tabular-nums">{item.quantity}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="break-inside-avoid rounded-2xl border border-[#dbe6f1] bg-[#f9fbfe] p-4">
            <p className="mb-2 text-lg font-bold text-[#0b2a55]">Invoice Summary</p>
            <SumRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
            <SumRow label="Discount" value={`-${formatCurrency(invoice.discount)}`} />
            <SumRow label="Tax" value={`+${formatCurrency(invoice.tax)}`} />
            <div className="mt-2 flex justify-between rounded-xl bg-[#e3effb] px-3 py-2.5 text-lg font-bold text-[#0b2a55]">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(total)}</span>
            </div>
            <div className="mt-2 flex justify-between rounded-xl bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
              <span>Paid</span>
              <span className="tabular-nums">{formatCurrency(paid)}</span>
            </div>
            <div
              className={cn(
                "mt-2 flex justify-between rounded-xl px-3 py-2 font-semibold",
                remaining > 0 ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"
              )}
            >
              <span>Remaining</span>
              <span className="tabular-nums">{formatCurrency(remaining)}</span>
            </div>
          </div>
        </div>

        <div className="mt-8 break-inside-avoid rounded-2xl border border-[#dbe6f1] bg-[#f6faff] px-5 py-4">
          <p className="text-lg font-bold text-[#0b2a55]">Notes</p>
          <p className="mt-1 text-sm whitespace-pre-line text-slate-700">{invoice.notes || "No additional notes."}</p>
        </div>

        <div className="mt-auto flex justify-between border-t border-[#cfdcea] pt-3 text-xs text-slate-500">
          <span>
            Generated on {formatDateTime(new Date())} · {clinic.clinicName}
          </span>
          <span>Thank you for your visit.</span>
        </div>
      </article>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="px-5 first:pl-0">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-0.5 text-lg font-medium text-[#0b2a55]">{children}</p>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-[#e6edf5] py-2 text-sm last:border-0">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}
