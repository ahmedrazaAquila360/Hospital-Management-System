import Link from "next/link";
import { Download, Eye, Printer, Receipt } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatCurrency, formatDate, initialsFromName } from "@/lib/format";
import { INVOICE_STATUS_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

export type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patientName: string;
  date: Date;
  total: number;
  paid: number;
  status: string;
};

/** Table on wide cards, stacked cards on narrow ones (container queries on the parent). */
export function InvoicesTable({ rows, filtered }: { rows: InvoiceRow[]; filtered: boolean }) {
  if (rows.length === 0) {
    return (
      <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
        <EmptyMedia variant="icon">
          <Receipt />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "No matching invoices" : "No invoices yet"}</EmptyTitle>
        <EmptyDescription>{filtered ? "Try a different invoice number, patient or status." : "Invoices you create will appear here."}</EmptyDescription>
      </Empty>
    );
  }

  return (
    <>
      <div className="hidden @4xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
              <th className="py-3 pr-3 pl-5">Invoice #</th>
              <th className="px-3 py-3">Patient</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3 text-right">Total</th>
              <th className="px-3 py-3 text-right">Paid</th>
              <th className="px-3 py-3 text-right">Remaining</th>
              <th className="px-3 py-3">Status</th>
              <th className="py-3 pr-5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((inv) => {
              const remaining = inv.status === "VOIDED" ? 0 : Math.max(0, inv.total - inv.paid);
              return (
                <tr key={inv.id} className="hover:bg-pale/40 transition-colors">
                  <td className="py-3 pr-3 pl-5">
                    <Link href={`/billing/invoices/${inv.id}`} className="text-brand font-mono text-[13px] font-semibold hover:underline">
                      {inv.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Patient inv={inv} />
                  </td>
                  <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">{formatDate(inv.date)}</td>
                  <td className="text-navy px-3 py-3 text-right font-semibold tabular-nums">{formatCurrency(inv.total)}</td>
                  <td className="text-success px-3 py-3 text-right tabular-nums">{formatCurrency(inv.paid)}</td>
                  <td className={cn("px-3 py-3 text-right tabular-nums", remaining > 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                    {formatCurrency(remaining)}
                  </td>
                  <td className="px-3 py-3">
                    <StatusBadge status={inv.status} tone={INVOICE_STATUS_TONE[inv.status]} />
                  </td>
                  <td className="py-3 pr-5 pl-3">
                    <Actions inv={inv} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ul className="divide-border/60 divide-y @4xl:hidden">
        {rows.map((inv) => {
          const remaining = inv.status === "VOIDED" ? 0 : Math.max(0, inv.total - inv.paid);
          return (
            <li key={inv.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/billing/invoices/${inv.id}`} className="text-brand font-mono text-[13px] font-semibold">
                    {inv.invoiceNumber}
                  </Link>
                  <div className="mt-1.5">
                    <Patient inv={inv} />
                  </div>
                </div>
                <StatusBadge status={inv.status} tone={INVOICE_STATUS_TONE[inv.status]} />
              </div>
              <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl p-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Total</dt>
                  <dd className="text-navy mt-0.5 font-semibold tabular-nums">{formatCurrency(inv.total)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Paid</dt>
                  <dd className="text-success mt-0.5 tabular-nums">{formatCurrency(inv.paid)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Remaining</dt>
                  <dd className={cn("mt-0.5 tabular-nums", remaining > 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                    {formatCurrency(remaining)}
                  </dd>
                </div>
              </dl>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">{formatDate(inv.date)}</span>
                <Actions inv={inv} />
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Patient({ inv }: { inv: InvoiceRow }) {
  return (
    <Link href={`/patients/${inv.patientId}`} className="group flex min-w-0 items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-[11px] font-semibold text-navy">
          {initialsFromName(inv.patientName)}
        </AvatarFallback>
      </Avatar>
      <span className="text-foreground group-hover:text-primary truncate font-medium transition-colors">{inv.patientName}</span>
    </Link>
  );
}

function Actions({ inv }: { inv: InvoiceRow }) {
  const actions = [
    { label: "View invoice", icon: Eye, href: `/billing/invoices/${inv.id}` },
    { label: "Print", icon: Printer, href: `/billing/invoices/${inv.id}/print`, newTab: true },
    { label: "Download PDF", icon: Download, href: `/api/invoices/${inv.id}/pdf`, download: `${inv.invoiceNumber}.pdf` },
  ];
  return (
    <div className="flex items-center justify-end gap-1.5">
      {actions.map(({ label, icon: Icon, href, newTab, download }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" size="icon" className="size-9 rounded-xl">
              {download ? (
                <a href={href} download={download} aria-label={`${label} ${inv.invoiceNumber}`}>
                  <Icon />
                </a>
              ) : (
                <Link href={href} target={newTab ? "_blank" : undefined} aria-label={`${label} ${inv.invoiceNumber}`}>
                  <Icon />
                </Link>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
