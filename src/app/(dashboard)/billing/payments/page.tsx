import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  CircleDollarSign,
  CreditCard,
  Eye,
  Landmark,
  Layers,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getPaymentStats, listPayments } from "@/server/billing/queries";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ListFooter } from "@/components/shared/list-footer";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { formatCurrency, formatDateTime, initialsFromName, toNumber } from "@/lib/format";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

const METHOD_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  CASH: { icon: Banknote, className: "bg-emerald-50 text-emerald-800" },
  CARD: { icon: CreditCard, className: "bg-blue-50 text-blue-800" },
  BANK_TRANSFER: { icon: Landmark, className: "bg-indigo-50 text-indigo-800" },
  INSURANCE: { icon: ShieldCheck, className: "bg-violet-50 text-violet-800" },
  OTHER: { icon: Wallet, className: "bg-slate-100 text-slate-700" },
};

type SearchParams = Promise<{ search?: string; page?: string; perPage?: string }>;

export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("billing.view");
  const params = await searchParams;
  const search = params.search?.trim() || undefined;

  const [list, stats,clinic] = await Promise.all([
    listPayments({ search, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getPaymentStats(),getClinicSettings(),
  ]);
  // The two largest methods by amount get their own cards (whatever they are in the data).
  const topMethods = stats.byMethod.slice(0, 2);


  const money=(value:unknown)=>formatCurrency(value,clinic.currency);
  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader icon={<CircleDollarSign />} title="Payments" description="All payments received against invoices." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Wallet} value={money(stats.total)} label="Total Collected" tone="success" />
        <StatCard icon={Layers} value={stats.count} label="Total Payments" />
        {topMethods.map((m) => (
          <StatCard
            key={m.method}
            icon={METHOD_STYLE[m.method]?.icon ?? Wallet}
            value={money(m.amount)}
            label={`${PAYMENT_METHOD_LABEL[m.method] ?? m.method} · ${stats.total ? Math.round((m.amount / stats.total) * 100) : 0}% of total`}
          />
        ))}
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <div className="p-4 sm:p-5">
          <ListSearch placeholder="Search by patient or invoice #…" param="search" className="lg:max-w-md" />
        </div>

        {list.payments.length === 0 ? (
          <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
            <EmptyMedia variant="icon">
              <CircleDollarSign />
            </EmptyMedia>
            <EmptyTitle>{search ? "No matching payments" : "No payments recorded"}</EmptyTitle>
            <EmptyDescription>
              {search ? "Try a different patient name or invoice number." : "Payments received against invoices will appear here."}
            </EmptyDescription>
          </Empty>
        ) : (
          <>
            <div className="hidden @4xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                    <th className="py-3 pr-3 pl-5">Patient</th>
                    <th className="px-3 py-3">Invoice #</th>
                    <th className="px-3 py-3">Method</th>
                    <th className="px-3 py-3">Payment Date</th>
                    <th className="px-3 py-3">Recorded By</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    <th className="py-3 pr-5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {list.payments.map((p) => (
                    <tr key={p.id} className="hover:bg-pale/40 transition-colors">
                      <td className="py-3 pr-3 pl-5">
                        <PersonCell name={p.patient.fullName} href={`/patients/${p.patientId}`} />
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/billing/invoices/${p.invoiceId}`} className="text-brand font-mono text-[13px] font-semibold hover:underline">
                          {p.invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        <MethodBadge method={p.method} reference={p.reference} />
                      </td>
                      <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="text-muted-foreground size-4" aria-hidden /> {formatDateTime(p.date)}
                        </span>
                      </td>
                      <td className="text-foreground/80 px-3 py-3">{p.receivedBy?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-success px-3 py-3 text-right font-semibold tabular-nums">{money(toNumber(p.amount))}</td>
                      <td className="py-3 pr-5 pl-3 text-right">
                        <Link href={`/billing/payments/${p.id}/receipt`} className="mr-2 underline">Receipt</Link>
                        <ViewInvoice id={p.invoiceId} number={p.invoice.invoiceNumber} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-border/60 divide-y @4xl:hidden">
              {list.payments.map((p) => (
                <li key={p.id} className="flex flex-col gap-2.5 px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <PersonCell name={p.patient.fullName} href={`/patients/${p.patientId}`} />
                    <span className="text-success font-semibold tabular-nums">{money(toNumber(p.amount))}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Link href={`/billing/invoices/${p.invoiceId}`} className="text-brand font-mono font-semibold">
                      {p.invoice.invoiceNumber}
                    </Link>
                    <MethodBadge method={p.method} reference={p.reference} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {formatDateTime(p.date)}
                    {p.receivedBy ? ` · by ${p.receivedBy.name}` : ""}
                  </p>
                  <Link href={`/billing/payments/${p.id}/receipt`} className="text-sm underline">Receipt</Link>
                </li>
              ))}
            </ul>

            <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={list.payments.length} noun="payment" />
          </>
        )}
      </section>
    </div>
  );
}

function PersonCell({ name, href }: { name: string; href: string }) {
  return (
    <Link href={href} className="group flex min-w-0 items-center gap-2.5">
      <Avatar className="size-8 shrink-0">
        <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-[11px] font-semibold text-navy">
          {initialsFromName(name)}
        </AvatarFallback>
      </Avatar>
      <span className="text-foreground group-hover:text-primary truncate font-medium transition-colors">{name}</span>
    </Link>
  );
}

function MethodBadge({ method, reference }: { method: string; reference: string | null }) {
  const style = METHOD_STYLE[method] ?? METHOD_STYLE.OTHER;
  const Icon = style.icon;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap", style.className)}
      title={reference ? `Reference: ${reference}` : undefined}
    >
      <Icon className="size-3.5" aria-hidden />
      {PAYMENT_METHOD_LABEL[method] ?? method}
    </span>
  );
}

function ViewInvoice({ id, number }: { id: string; number: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button asChild variant="outline" size="icon" className="size-9 rounded-xl">
          <Link href={`/billing/invoices/${id}`} aria-label={`View invoice ${number}`}>
            <Eye />
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>View invoice</TooltipContent>
    </Tooltip>
  );
}
