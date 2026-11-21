import { INVOICE_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const INVOICE_STATUS_STYLE: Record<string, string> = {
  UNPAID: "bg-rose-50 text-rose-700 ring-rose-200",
  PARTIALLY_PAID: "bg-amber-50 text-amber-800 ring-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/** Status pill used on the invoice page (dot + label). */
export function InvoiceStatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold whitespace-nowrap ring-1 ring-inset",
        INVOICE_STATUS_STYLE[status] ?? INVOICE_STATUS_STYLE.UNPAID,
        className
      )}
    >
      <span className="size-2 rounded-full bg-current" aria-hidden />
      {INVOICE_STATUS_LABEL[status] ?? status}
    </span>
  );
}
