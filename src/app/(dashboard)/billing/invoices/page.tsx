import type { Metadata } from "next";
import Link from "next/link";
import { CircleDollarSign, FileText, Plus, Receipt, Wallet } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getInvoiceStats, invoicePaidAmount, listInvoices } from "@/server/billing/queries";
import { InvoicesToolbar } from "@/components/billing/invoices-toolbar";
import { InvoicesTable } from "@/components/billing/invoices-table";
import { ListFooter } from "@/components/shared/list-footer";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { formatCurrency, toNumber } from "@/lib/format";
import { INVOICE_STATUS_LABEL } from "@/lib/labels";
import type { InvoiceStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Invoices" };

type SearchParams = Promise<{ search?: string; status?: string; page?: string; perPage?: string }>;

export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("billing.view");
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  // An unknown status would reach Prisma as an invalid enum and fail the page.
  const status = Object.keys(INVOICE_STATUS_LABEL).find((s) => s === params.status) as InvoiceStatus | undefined;

  const [list, stats] = await Promise.all([
    listInvoices({ search, status, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getInvoiceStats(),
  ]);
  const rows = list.invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    patientId: inv.patientId,
    patientName: inv.patient.fullName,
    date: inv.date,
    total: toNumber(inv.total),
    paid: invoicePaidAmount(inv),
    status: inv.voidedAt?"VOIDED":inv.status,
  }));


  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<Receipt />}
          title="Invoices"
          description="Manage and track patient invoices, payments and balances."
          actions={
            can(user, "billing.create") && (
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/billing/invoices/new">
                  <Plus /> New Invoice
                </Link>
              </Button>
            )
          }
        />
        <ToothOutline className="absolute -top-3 right-56 hidden xl:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={FileText} value={stats.count} label="Total Invoices" />
        <StatCard icon={Receipt} value={formatCurrency(stats.totalBilled)} label="Total Billed" />
        <StatCard icon={Wallet} value={formatCurrency(stats.totalPaid)} label="Total Paid" tone="success" />
        <StatCard icon={CircleDollarSign} value={formatCurrency(stats.outstanding)} label="Outstanding" tone="destructive" />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <InvoicesToolbar />
        <InvoicesTable rows={rows} filtered={Boolean(search || status)} />
        {rows.length > 0 && (
          <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={rows.length} noun="invoice" />
        )}
      </section>
    </div>
  );
}
