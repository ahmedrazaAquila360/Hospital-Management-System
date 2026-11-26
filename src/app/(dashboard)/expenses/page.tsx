import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import {
  CalendarDays,
  Ellipsis,
  House,
  Megaphone,
  Monitor,
  Package,
  PieChart,
  ReceiptText,
  Users,
  Wallet,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { listExpenses, getExpenseSummary } from "@/server/expenses/queries";
import { ExpensesToolbar } from "@/components/expenses/expenses-toolbar";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ListFooter } from "@/components/shared/list-footer";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { formatCurrency, formatDate, toNumber } from "@/lib/format";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";
import { EXPENSE_CATEGORIES } from "@/lib/validations/expense";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Expenses" };

const CATEGORY_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  RENT: { icon: House, className: "bg-rose-50 text-rose-800" },
  UTILITIES: { icon: Zap, className: "bg-amber-50 text-amber-800" },
  SALARIES: { icon: Users, className: "bg-emerald-50 text-emerald-800" },
  EQUIPMENT: { icon: Monitor, className: "bg-blue-50 text-blue-800" },
  SUPPLIES: { icon: Package, className: "bg-teal-50 text-teal-800" },
  MAINTENANCE: { icon: Wrench, className: "bg-indigo-50 text-indigo-800" },
  MARKETING: { icon: Megaphone, className: "bg-violet-50 text-violet-800" },
  OTHER: { icon: Ellipsis, className: "bg-slate-100 text-slate-700" },
};

type SearchParams = Promise<{ search?: string; category?: string; page?: string; perPage?: string }>;

export default async function ExpensesPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("expenses.view");
  const currency=(await getClinicSettings()).currency;
  const money=(value:unknown)=>formatCurrency(value,currency);
  const params = await searchParams;
  const canCreate = can(user, "expenses.create");
  const canManage = can(user, "expenses.delete");
  const search = params.search?.trim() || undefined;
  // An unknown category would reach Prisma as an invalid enum and fail the page.
  const category = EXPENSE_CATEGORIES.find((c) => c === params.category) as ExpenseCategory | undefined;

  const [{ expenses, total, page, pageSize, sum }, summary] = await Promise.all([
    listExpenses({ search, category, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getExpenseSummary(),
  ]);
  const allTime = summary.byCategory.reduce((s, c) => s + c.total, 0);
  const top = [...summary.byCategory].sort((a, b) => b.total - a.total)[0];
  const filtered = Boolean(search || category);


  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<ReceiptText />}
          title="Expenses"
          description="Track clinic expenses, operational costs and purchases."
          actions={canCreate && <AddExpenseDialog currency={currency} />}
        />
        <ToothOutline className="absolute -top-3 right-56 hidden xl:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Wallet} value={money(allTime)} label="All-time Expenses" />
        <StatCard icon={CalendarDays} value={money(summary.thisMonthTotal)} label="This Month" />
        <StatCard
          icon={PieChart}
          value={top ? money(top.total) : "—"}
          label={top ? `Top: ${EXPENSE_CATEGORY_LABEL[top.category]}` : "Top category"}
          tone="warning"
        />
        <StatCard icon={ReceiptText} value={money(sum)} label={filtered ? `Filtered total · ${total}` : `${total} expense${total === 1 ? "" : "s"} recorded`} />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <ExpensesToolbar />

        {expenses.length === 0 ? (
          <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
            <EmptyMedia variant="icon">
              <Wallet />
            </EmptyMedia>
            <EmptyTitle>{filtered ? "No matching expenses" : "No expenses yet"}</EmptyTitle>
            <EmptyDescription>{filtered ? "Try a different title or category." : "Add your first clinic expense to start tracking costs."}</EmptyDescription>
          </Empty>
        ) : (
          <>
            <div className="hidden @4xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
                    <th className="py-3 pr-3 pl-5">Date</th>
                    <th className="px-3 py-3">Title</th>
                    <th className="px-3 py-3">Category</th>
                    <th className="px-3 py-3">Added By</th>
                    <th className="px-3 py-3 text-right">Amount</th>
                    {canManage && <th className="py-3 pr-5 pl-3 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {expenses.map((e) => (
                    <tr key={e.id} className="hover:bg-pale/40 transition-colors">
                      <td className="text-foreground/80 py-3 pr-3 pl-5 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <CalendarDays className="text-muted-foreground size-4" aria-hidden /> {formatDate(e.date)}
                        </span>
                      </td>
                      <td className="max-w-80 px-3 py-3">
                        <p className="text-navy truncate font-semibold">{e.title}</p>
                        {e.description && <p className="text-muted-foreground truncate text-xs">{e.description}</p>}
                      </td>
                      <td className="px-3 py-3">
                        <CategoryBadge category={e.category} />
                      </td>
                      <td className="text-foreground/80 px-3 py-3">{e.addedBy?.name ?? <span className="text-muted-foreground">—</span>}</td>
                      <td className="text-navy px-3 py-3 text-right font-semibold tabular-nums">{money(toNumber(e.amount))}</td>
                      {canManage && (
                        <td className="py-3 pr-5 pl-3 text-right">
                          <DeleteExpenseButton id={e.id} title={e.title} />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-border/60 divide-y @4xl:hidden">
              {expenses.map((e) => (
                <li key={e.id} className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-navy font-semibold">{e.title}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <CategoryBadge category={e.category} />
                      <span className="text-muted-foreground">{formatDate(e.date)}</span>
                      {e.addedBy && <span className="text-muted-foreground">· {e.addedBy.name}</span>}
                    </div>
                    {e.description && <p className="text-muted-foreground text-xs">{e.description}</p>}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span className="text-navy font-semibold tabular-nums">{money(toNumber(e.amount))}</span>
                    {canManage && <DeleteExpenseButton id={e.id} title={e.title} />}
                  </div>
                </li>
              ))}
            </ul>

            <ListFooter page={page} pageSize={pageSize} total={total} shown={expenses.length} noun="expense" extra={money(sum)} />
          </>
        )}
      </section>
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const style = CATEGORY_STYLE[category] ?? CATEGORY_STYLE.OTHER;
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", style.className)}>
      <Icon className="size-3.5" aria-hidden />
      {EXPENSE_CATEGORY_LABEL[category] ?? category}
    </span>
  );
}
