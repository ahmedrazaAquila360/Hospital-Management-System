import Link from "next/link";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PanelCard } from "@/components/dashboard/panels/panel-card";
import { formatCurrency, formatRelative, titleCase } from "@/lib/format";
import { CircleDollarSign, Receipt } from "lucide-react";
import type { getRecentPayments } from "@/server/dashboard/queries";

type Payment = Awaited<ReturnType<typeof getRecentPayments>>[number];

export function RecentPaymentsPanel({ payments }: { payments: Payment[] }) {
  return (
    <PanelCard title="Recent Payments" viewAllHref="/billing/payments">
      {payments.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <Receipt />
          </EmptyMedia>
          <EmptyTitle>No payments yet</EmptyTitle>
          <EmptyDescription>Recorded payments will appear here.</EmptyDescription>
        </Empty>
      ) : (
        <ul className="-mx-2">
          {payments.map((p) => (
            <li key={p.id}>
              <Link
                href={`/billing/invoices/${p.invoiceId}`}
                className="hover:bg-pale/60 flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors"
              >
                <span className="text-success flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f6ef] ring-1 ring-[#c4e9d6] ring-inset">
                  <CircleDollarSign className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.patient.fullName}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {titleCase(p.method)} · {p.invoice.invoiceNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-navy font-semibold tabular">{formatCurrency(p.amount)}</p>
                  <p className="text-muted-foreground text-xs">{formatRelative(p.date)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
