import Link from "next/link";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PanelCard } from "@/components/dashboard/panels/panel-card";
import { formatCurrency, formatDate } from "@/lib/format";
import { CircleCheck, TriangleAlert } from "lucide-react";
import type { getOutstandingBalances } from "@/server/dashboard/queries";

type Invoice = Awaited<ReturnType<typeof getOutstandingBalances>>[number];

export function OutstandingBalancesPanel({currency,  invoices }: { currency:string; invoices: Invoice[] }) {
  const money=(value:unknown)=>formatCurrency(value,currency);
  return (
    <PanelCard title="Outstanding Balances" viewAllHref="/billing/invoices">
      {invoices.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CircleCheck />
          </EmptyMedia>
          <EmptyTitle>All settled</EmptyTitle>
          <EmptyDescription>No outstanding balances right now.</EmptyDescription>
        </Empty>
      ) : (
        <ul className="-mx-2">
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/billing/invoices/${inv.id}`}
                className="hover:bg-pale/60 flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors"
              >
                <span className="text-warning-foreground flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#fff4e1] ring-1 ring-[#f5dcae] ring-inset">
                  <TriangleAlert className="size-4.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{inv.patient.fullName}</p>
                  <p className="text-muted-foreground truncate text-xs">
                    {inv.invoiceNumber} · {formatDate(inv.date)}
                  </p>
                </div>
                <p className="text-destructive font-semibold tabular">{money(inv.remaining)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
