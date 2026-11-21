import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

export async function getPatientReport(start: Date, end: Date) {
  const [total, newPatients, returningAppointmentPatients] = await Promise.all([
    prisma.patient.count(),
    prisma.patient.count({ where: { createdAt: { gte: start, lte: end } } }),
    prisma.appointment.findMany({
      where: { date: { gte: start, lte: end }, patient: { createdAt: { lt: start } } },
      select: { patientId: true },
      distinct: ["patientId"],
    }),
  ]);

  return {
    total,
    newPatients,
    returningPatients: returningAppointmentPatients.length,
  };
}

export async function getAppointmentReport(start: Date, end: Date) {
  const [completed, cancelled, noShow, upcoming, total] = await Promise.all([
    prisma.appointment.count({ where: { date: { gte: start, lte: end }, status: "COMPLETED" } }),
    prisma.appointment.count({ where: { date: { gte: start, lte: end }, status: "CANCELLED" } }),
    prisma.appointment.count({ where: { date: { gte: start, lte: end }, status: "NO_SHOW" } }),
    prisma.appointment.count({ where: { date: { gt: end }, status: { in: ["SCHEDULED", "CONFIRMED"] } } }),
    prisma.appointment.count({ where: { date: { gte: start, lte: end } } }),
  ]);

  return { total, completed, cancelled, noShow, upcoming };
}

export async function getFinancialReport(start: Date, end: Date) {
  const [paymentsAgg, paymentsCount, expensesAgg, outstandingInvoices, serviceRevenue] = await Promise.all([
    prisma.payment.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }),
    prisma.payment.count({ where: { date: { gte: start, lte: end } } }),
    prisma.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }),
    prisma.invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      select: { total: true, payments: { select: { amount: true } } },
    }),
    prisma.$queryRaw<{ category: string; revenue: number }[]>`
      SELECT CASE split_part(i."invoiceNumber", '-', 1) WHEN 'OPD' THEN 'Consultations' WHEN 'LAB' THEN 'Laboratory'
        WHEN 'PH' THEN 'Pharmacy' WHEN 'IPD' THEN 'Admissions' ELSE 'Other services' END AS category,
        sum(p.amount)::float8 AS revenue FROM "Payment" p JOIN "Invoice" i ON i.id=p."invoiceId"
        WHERE p.date BETWEEN ${start} AND ${end} GROUP BY 1 ORDER BY 1`,
  ]);

  const outstanding = outstandingInvoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return sum + Math.max(0, toNumber(inv.total) - paid);
  }, 0);

  const revenue = toNumber(paymentsAgg._sum.amount);
  const expenses = toNumber(expensesAgg._sum.amount);

  return {
    revenue,
    paymentsCount,
    outstanding,
    expenses,
    netIncome: revenue - expenses, serviceRevenue,
  };
}

export async function getTreatmentReport(start: Date, end: Date) {
  const [grouped, revenueAgg, completed, pending] = await Promise.all([
    prisma.treatment.groupBy({
      by: ["name"],
      where: { createdAt: { gte: start, lte: end } },
      _count: { _all: true },
      orderBy: { _count: { name: "desc" } },
      take: 8,
    }),
    prisma.treatment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { cost: true, discount: true },
    }),
    prisma.treatment.count({ where: { createdAt: { gte: start, lte: end }, status: "COMPLETED" } }),
    prisma.treatment.count({ where: { createdAt: { gte: start, lte: end }, status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
  ]);

  const revenue = revenueAgg.reduce((sum, t) => sum + (toNumber(t.cost) - toNumber(t.discount)), 0);

  return {
    mostCommon: grouped.map((g) => ({ name: g.name, count: g._count._all })),
    revenue,
    completed,
    pending,
  };
}
