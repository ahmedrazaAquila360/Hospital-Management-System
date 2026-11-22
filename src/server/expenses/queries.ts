import "server-only";
import { calendarDay, shiftMonth } from "@/lib/report-calendar";
import { hospitalZone } from "@/server/reports/calendar";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { toNumber } from "@/lib/format";
import type { ExpenseCategory } from "@/generated/prisma/enums";

export const EXPENSES_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type ExpenseFilters = { search?: string; category?: ExpenseCategory; page?: number; pageSize?: number };

export async function listExpenses(filters: ExpenseFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = {
    AND: [
      filters.search ? { title: { contains: filters.search, mode: "insensitive" as const } } : {},
      filters.category ? { category: filters.category } : {},
    ],
  };

  const [total, expenses, sumResult] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { addedBy: true },
    }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);

  return {
    expenses,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    sum: toNumber(sumResult._sum.amount),
  };
}

export async function getExpenseSummary() {
  const today = calendarDay(await hospitalZone());
  const monthStart = new Date(shiftMonth(today, 0));
  const monthEnd = new Date(shiftMonth(today, 1));

  const [thisMonth, byCategory] = await Promise.all([
    prisma.expense.aggregate({ where: { date: { gte: monthStart, lt: monthEnd } }, _sum: { amount: true } }),
    prisma.expense.groupBy({ by: ["category"], _sum: { amount: true }, orderBy: { category: "asc" } }),
  ]);

  return {
    thisMonthTotal: toNumber(thisMonth._sum.amount),
    byCategory: byCategory.map((c) => ({ category: c.category, total: toNumber(c._sum.amount) })),
  };
}
