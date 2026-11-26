import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { INVOICE_STATUS_TONE } from "@/lib/status";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function BillingTab({currency,  patient }: { currency:string; patient: Patient }) {
  const money=(value:unknown)=>formatCurrency(value,currency);
  if (patient.invoices.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyMedia variant="icon">
              <Receipt />
            </EmptyMedia>
            <EmptyTitle>No invoices yet</EmptyTitle>
            <EmptyDescription>Invoices and payments for this patient will appear here.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {patient.invoices.map((inv) => {
          const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
          const remaining = inv.voidedAt ? 0 : toNumber(inv.total) - paid;
          return (
            <Link
              key={inv.id}
              href={`/billing/invoices/${inv.id}`}
              className="hover:bg-accent/50 flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(inv.date)} · {inv.items.length} item{inv.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                  <p className="font-medium">{money(inv.total)}</p>
                  {remaining > 0 && <p className="text-destructive text-xs">{money(remaining)} due</p>}
                </div>
                <StatusBadge status={inv.voidedAt?"VOIDED":inv.status} tone={INVOICE_STATUS_TONE[inv.voidedAt?"VOIDED":inv.status]} />
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
