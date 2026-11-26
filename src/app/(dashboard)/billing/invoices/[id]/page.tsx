import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Download,
  FileText,
  Info,
  NotebookPen,
  Printer,
  ReceiptText,
  Stethoscope,
  UserRound,
  UserRoundPen,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getInvoiceById, invoicePaidAmount } from "@/server/billing/queries";
import { Button } from "@/components/ui/button";
import { RefundForm } from "@/components/billing/refund-form";
import { RecordPaymentDialog } from "@/components/billing/record-payment-dialog";
import { InvoiceStatusPill } from "@/components/billing/invoice-status";
import {voidInvoiceAction} from "@/server/billing/actions";
import { formatCurrency, formatDate, formatDateTime, toNumber } from "@/lib/format";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoice Details" };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("billing.view");
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const total = toNumber(invoice.total);
  const paid = invoicePaidAmount(invoice);
  const remaining = invoice.voidedAt ? 0 : Math.max(0, Math.round((total - paid) * 100) / 100);
  const paidPct = total > 0 ? Math.min(100, (paid / total) * 100) : 100;
  const canManage = can(user, "billing.payments")&&!invoice.voidedAt;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <nav aria-label="Breadcrumb" className="flex items-center gap-3 text-sm">
        <Button asChild variant="outline" size="icon" className="size-9 rounded-xl">
          <Link href="/billing/invoices" aria-label="Back to invoices">
            <ArrowLeft />
          </Link>
        </Button>
        <ol className="text-muted-foreground flex flex-wrap items-center gap-1.5">
          <li>Billing</li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li>
            <Link href="/billing/invoices" className="hover:text-navy font-medium">
              Invoices
            </Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden />
          <li className="text-navy font-semibold" aria-current="page">
            {invoice.invoiceNumber}
          </li>
        </ol>
      </nav>

      {/* Header */}
      <section className="surface-card flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="bg-pale text-brand flex size-14 shrink-0 items-center justify-center rounded-2xl" aria-hidden>
            <FileText className="size-6" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-heading text-navy text-2xl font-semibold tracking-tight sm:text-[1.7rem]">{invoice.invoiceNumber}</h2>
              <InvoiceStatusPill status={invoice.voidedAt?"VOIDED":invoice.status} />
            </div>
            <p className="text-muted-foreground mt-0.5">
              Invoice for{" "}
              <Link href={`/patients/${invoice.patientId}`} className="text-foreground/85 hover:text-primary font-medium">
                {invoice.patient.fullName}
              </Link>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href={`/billing/invoices/${invoice.id}/print`} target="_blank" rel="noopener noreferrer">
              <Printer /> Print
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <Link href={`/billing/patients/${invoice.patientId}/statement`} target="_blank" rel="noopener noreferrer">Patient statement</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="rounded-xl">
            <a href={`/api/invoices/${invoice.id}/pdf`} download={`${invoice.invoiceNumber}.pdf`}>
              <Download /> Download PDF
            </a>
          </Button>
          {canManage && (
            <RecordPaymentDialog
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber}
              total={total}
              remaining={remaining}
              triggerClassName="col-span-2 sm:col-span-1"
            />
          )}
        </div>
      </section>

      {invoice.voidedAt&&<p className="surface-card p-5 font-semibold">VOIDED · {invoice.voidReason} · {formatDateTime(invoice.voidedAt)}. Retained for audit; excluded from balances.</p>}
      {!invoice.voidedAt&&can(user,"billing.void")&&["ADMIN","SUPER_ADMIN"].includes(user.role.name)&&invoice.invoiceNumber.startsWith("HINV-")&&paid===0&&!invoice.items.some(item=>item.serviceCharge)&&<details className="surface-card p-5"><summary>Void unpaid manual invoice</summary><form action={voidInvoiceAction} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="invoiceId" value={invoice.id}/><input name="reason" required minLength={3} maxLength={500} placeholder="Reason for void" aria-label="Void reason" className="rounded border p-2"/><Button variant="outline">Void invoice</Button></form></details>}
      {!invoice.voidedAt&&can(user,"billing.refund") && paid > 0 && <details className="surface-card p-5"><summary>Record refund</summary>
        <RefundForm invoiceId={id} paid={paid}/></details>}
      {/* Key facts */}
      <section className="surface-card grid grid-cols-1 gap-y-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-4 xl:divide-x xl:divide-border/70">
        <Fact icon={UserRound} label="Patient">
          <Link href={`/patients/${invoice.patientId}`} className="hover:text-primary">
            {invoice.patient.fullName}
          </Link>
        </Fact>
        <Fact icon={CalendarDays} label="Invoice Date">
          {formatDate(invoice.date)}
        </Fact>
        <Fact icon={UserRoundPen} label="Created By">
          {invoice.createdBy?.name ?? <span className="text-muted-foreground font-normal">—</span>}
        </Fact>
        <Fact icon={Stethoscope} label="Dentist">
          {invoice.dentist?.name ?? <span className="text-muted-foreground font-normal">Not assigned</span>}
        </Fact>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-5">
          {/* Line items */}
          <section className="surface-card @container overflow-hidden p-0">
            <CardTitle icon={ReceiptText} title="Line Items" className="px-5 pt-5 pb-4 sm:px-6" />
            <div className="hidden @xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                    <th className="w-14 py-3 pr-2 pl-6">#</th>
                    <th className="px-3 py-3">Description</th>
                    <th className="px-3 py-3 text-center">Qty</th>
                    <th className="px-3 py-3 text-right">Unit Price</th>
                    <th className="py-3 pr-6 pl-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {invoice.items.map((item, i) => (
                    <tr key={item.id}>
                      <td className="text-muted-foreground py-3.5 pr-2 pl-6 tabular-nums">{i + 1}</td>
                      <td className="text-navy px-3 py-3.5 font-medium">
                        {item.description}
                        {item.treatment && item.treatment.name !== item.description && (
                          <span className="text-muted-foreground block text-xs font-normal">Treatment: {item.treatment.name}</span>
                        )}
                      </td>
                      <td className="text-foreground/80 px-3 py-3.5 text-center tabular-nums">{item.quantity}</td>
                      <td className="text-foreground/80 px-3 py-3.5 text-right tabular-nums">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-navy py-3.5 pr-6 pl-3 text-right font-semibold tabular-nums">{formatCurrency(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-border/60 divide-y border-t @xl:hidden">
              {invoice.items.map((item, i) => (
                <li key={item.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="text-navy font-medium">
                      <span className="text-muted-foreground mr-2 tabular-nums">{i + 1}.</span>
                      {item.description}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <span className="text-navy font-semibold tabular-nums">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </section>

          <div className="grid gap-5 md:grid-cols-2">
            <section className="surface-card p-5 sm:p-6">
              <CardTitle icon={NotebookPen} title="Notes" />
              <p className={cn("mt-4 text-sm leading-relaxed whitespace-pre-line", invoice.notes ? "text-foreground/85" : "text-muted-foreground")}>
                {invoice.notes || "No additional notes."}
              </p>
            </section>
            <section className="surface-card p-5 sm:p-6">
              <CardTitle icon={Info} title="Invoice Information" />
              <dl className="mt-4 space-y-2.5 text-sm">
                <InfoRow label="Invoice #" value={invoice.invoiceNumber} />
                <InfoRow label="Patient" value={invoice.patient.fullName} />
                <InfoRow label="Patient ID" value={invoice.patient.patientCode} />
                <InfoRow label="Created By" value={invoice.createdBy?.name ?? "—"} />
                <InfoRow label="Created At" value={formatDateTime(invoice.createdAt)} />
                <InfoRow label="Payments" value={invoice.payments.length ? `${invoice.payments.length} recorded` : "None yet"} />
              </dl>
            </section>
          </div>
        </div>

        {/* Summary */}
        <aside className="surface-card p-5 sm:p-6 xl:sticky xl:top-24">
          <CardTitle icon={ReceiptText} title="Invoice Summary" />
          <dl className="mt-4 text-sm">
            <SummaryRow label="Subtotal" value={formatCurrency(invoice.subtotal)} />
            <SummaryRow label="Discount" value={`-${formatCurrency(invoice.discount)}`} />
            <SummaryRow label="Tax" value={`+${formatCurrency(invoice.tax)}`} />
          </dl>
          <div className="bg-pale mt-3 flex items-center justify-between rounded-2xl px-4 py-3.5">
            <span className="text-navy text-lg font-semibold">Total</span>
            <span className="font-heading text-navy text-2xl font-semibold tabular-nums">{formatCurrency(total)}</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 font-semibold text-emerald-700">
            <span>Paid</span>
            <span className="tabular-nums">{formatCurrency(paid)}</span>
          </div>
          <div
            className={cn(
              "mt-2 flex items-center justify-between rounded-xl px-4 py-3 font-semibold",
              remaining > 0 ? "bg-rose-50 text-rose-700" : "bg-muted/60 text-muted-foreground"
            )}
          >
            <span>Remaining</span>
            <span className="tabular-nums">{formatCurrency(remaining)}</span>
          </div>
          <div className="mt-4">
            <div className="text-muted-foreground mb-1.5 flex justify-between text-xs">
              <span>Payment progress</span>
              <span className="tabular-nums">{Math.round(paidPct)}% paid</span>
            </div>
            <div className="bg-muted h-2 overflow-hidden rounded-full" role="progressbar" aria-valuenow={Math.round(paidPct)} aria-valuemin={0} aria-valuemax={100} aria-label="Paid">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function CardTitle({ icon: Icon, title, className }: { icon: LucideIcon; title: string; className?: string }) {
  return (
    <h2 className={cn("text-navy flex items-center gap-2.5 text-lg font-semibold tracking-tight", className)}>
      <span className="bg-pale text-brand flex size-9 items-center justify-center rounded-xl" aria-hidden>
        <Icon className="size-[1.1rem]" />
      </span>
      {title}
    </h2>
  );
}

function Fact({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 xl:px-5 xl:first:pl-0 xl:last:pr-0">
      <span className="bg-pale text-brand flex size-11 shrink-0 items-center justify-center rounded-full" aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="text-navy truncate font-semibold">{children}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground/90 truncate text-right font-medium">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 flex justify-between border-b py-2.5 last:border-0">
      <dt className="text-foreground/75">{label}</dt>
      <dd className="text-navy font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
