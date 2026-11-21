import "server-only";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function monthsAgo(n: number) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - n, 1);
}

export async function getDashboardStats(selectedDay?: string, selectedZone?: string) {
  const zone = selectedZone ?? (await prisma.clinicSettings.findFirst({ select: { timeZone: true } }))?.timeZone ?? "UTC";
  const day = selectedDay ?? new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [{ today0, until }] = await prisma.$queryRaw<{today0: Date; until: Date}[]>`SELECT
    (${day}::date::timestamp AT TIME ZONE ${zone}) AS "today0",
    ((${day}::date + 1)::timestamp AT TIME ZONE ${zone}) AS until`;
  const today1 = new Date(until.getTime()-1);
  const month0 = startOfMonth();

  const [
    totalPatients,
    todayAppointments,
    completedAppointmentsToday,
    pendingAppointmentsToday,
    todayPayments,
    outstandingInvoices,
    newPatientsThisMonth,
    activeTreatments, opdVisits, admissions, beds, emergencies,
  ] = await Promise.all([
    prisma.patient.count(),
    prisma.appointment.count({ where: { date: new Date(day) } }),
    prisma.appointment.count({ where: { date: new Date(day), status: "COMPLETED" } }),
    prisma.appointment.count({
      where: {
        date: new Date(day),
        status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] },
      },
    }),
    prisma.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: today0, lte: today1 } } }),
    prisma.invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      select: { total: true, payments: { select: { amount: true } } },
    }),
    prisma.patient.count({ where: { createdAt: { gte: month0 } } }),
    prisma.treatment.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
    prisma.encounter.count({ where: { appointmentId: { not: null }, checkedInAt: { gte: today0, lte: today1 } } }),
    prisma.admission.count({ where: { dischargedAt: null, status: { notIn:["REQUESTED","CANCELLED"] } } }),
    prisma.bed.groupBy({ by: ["status"], _count: true }),
    prisma.appointment.findMany({ where: { emergency: true, status: { in: ["CHECKED_IN","IN_PROGRESS"] } }, select: { patientId: true }, distinct: ["patientId"] }),
  ]);

  const outstandingPayments = outstandingInvoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return sum + (toNumber(inv.total) - paid);
  }, 0);

  return {
    emergencies: emergencies.length, opdVisits, admissions,
    occupied: beds.find(b => b.status === "OCCUPIED")?._count ?? 0,
    available: beds.find(b => b.status === "AVAILABLE")?._count ?? 0,
    bedCount: beds.reduce((sum,b) => sum+b._count,0),
    totalPatients, todayAppointments, completedAppointmentsToday, pendingAppointmentsToday,
    todayRevenue: toNumber(todayPayments._sum.amount),
    outstandingPayments,
    newPatientsThisMonth,
    activeTreatments,
  };
}

export async function getRevenueOverview(months = 6) {
  const since = monthsAgo(months - 1);
  const payments = await prisma.payment.findMany({
    where: { date: { gte: since } },
    select: { amount: true, date: true },
  });

  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = monthsAgo(i);
    buckets.set(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), 0);
  }
  for (const p of payments) {
    const key = p.date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + toNumber(p.amount));
  }

  return Array.from(buckets.entries()).map(([month, revenue]) => ({ month, revenue }));
}

export async function getAppointmentStats() {
  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: { date: { gte: since } },
    select: { date: true, status: true },
  });

  const buckets = new Map<string, { day: string; completed: number; cancelled: number; scheduled: number }>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toLocaleDateString("en-US", { weekday: "short" });
    buckets.set(key, { day: key, completed: 0, cancelled: 0, scheduled: 0 });
  }
  for (const a of appointments) {
    const key = a.date.toLocaleDateString("en-US", { weekday: "short" });
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (a.status === "COMPLETED") bucket.completed++;
    else if (a.status === "CANCELLED" || a.status === "NO_SHOW") bucket.cancelled++;
    else bucket.scheduled++;
  }

  return Array.from(buckets.values());
}

export async function getPatientGrowth(months = 6) {
  const since = monthsAgo(months - 1);
  const patients = await prisma.patient.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = months - 1; i >= 0; i--) {
    const d = monthsAgo(i);
    buckets.set(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), 0);
  }
  for (const p of patients) {
    const key = p.createdAt.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([month, patients]) => ({ month, patients }));
}

export async function getTreatmentStats() {
  const grouped = await prisma.treatment.groupBy({
    by: ["name"],
    _count: { _all: true },
    orderBy: { _count: { name: "desc" } },
    take: 6,
  });
  return grouped.map((g) => ({ name: g.name, count: g._count._all }));
}

export async function getTodayAppointments(day: string, dentistId?: string) {
  return prisma.appointment.findMany({
    where: { date: new Date(day), dentistId },
    include: { patient: true, dentist: true },
    orderBy: { startTime: "asc" },
    take: 8,
  });
}

export async function getUpcomingAppointments(dentistId?: string) {
  const tomorrow = startOfDay();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return prisma.appointment.findMany({
    where: { dentistId, date: { gte: tomorrow }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    include: { patient: true, dentist: true },
    orderBy: { date: "asc" },
    take: 6,
  });
}

export async function getRecentPatients(dentistId?: string) {
  return prisma.patient.findMany({
    where: { archivedAt: null, ...(dentistId && { OR: [{ createdById: dentistId },{ appointments: { some: { dentistId } } },{ admissions: { some: { doctorId: dentistId } } }] }) }, orderBy: { createdAt: "desc" }, take: 6 });
}

export async function getRecentPayments() {
  return prisma.payment.findMany({
    include: { patient: true, invoice: true },
    orderBy: { date: "desc" },
    take: 6,
  });
}

export async function getOutstandingBalances() {
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
    include: { patient: true, payments: { select: { amount: true } } },
    orderBy: { date: "desc" },
    take: 6,
  });

  return invoices
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      patient: inv.patient,
      total: toNumber(inv.total),
      paid: inv.payments.reduce((s, p) => s + toNumber(p.amount), 0),
      date: inv.date,
    }))
    .map((inv) => ({ ...inv, remaining: inv.total - inv.paid }))
    .sort((a, b) => b.remaining - a.remaining);
}

export async function getDepartmentCensus(from: string, through: string) {
  return prisma.$queryRaw<{ name: string; patients: number; visits: number }[]>`
    SELECT d.name, count(DISTINCT v.patient)::int AS patients, count(v.patient)::int AS visits
    FROM "Department" d LEFT JOIN (
      SELECT a."departmentId" AS department, a."patientId" AS patient
      FROM "Appointment" a JOIN "Encounter" e ON e."appointmentId" = a.id
      WHERE a.date BETWEEN ${from}::date AND ${through}::date
      UNION ALL
      SELECT a."departmentId",a."patientId" FROM "Admission" a
      WHERE a.status NOT IN ('REQUESTED','CANCELLED') AND ((a."admittedAt" AT TIME ZONE 'UTC') AT TIME ZONE coalesce((SELECT "timeZone" FROM "ClinicSettings" LIMIT 1),'UTC'))::date
        BETWEEN ${from}::date AND ${through}::date
    ) v ON v.department=d.id GROUP BY d.id,d.name ORDER BY patients DESC,d.name`;
}
