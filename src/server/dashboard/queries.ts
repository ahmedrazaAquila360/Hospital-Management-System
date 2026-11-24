import "server-only";
import { requireUser } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { can, requiresPatientAssignment } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toNumber } from "@/lib/format";

import { calendarDay, shiftDay, shiftMonth } from "@/lib/report-calendar";
import { calendarBounds, hospitalZone } from "@/server/reports/calendar";

async function monthlyWindow(months: number) {
  const zone = await hospitalZone();
  const day = calendarDay(zone);
  const first = shiftMonth(day, 1 - months);
  const bounds = await calendarBounds(first, shiftDay(shiftMonth(day, 1), -1), zone);
  const buckets = new Map<string, number>();
  for (let i = 0; i < months; i++) buckets.set(shiftMonth(first, i).slice(0, 7), 0);
  return { zone, bounds, buckets };
}
function monthLabel(month: string) {
  return new Date(month + "-01T00:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", month: "short", year: "2-digit" });
}

export async function getDashboardStats(selectedDay?: string, selectedZone?: string) {
  const actor = await requireUser();
  const patient = can(actor,"patients.view") ? patientScope(actor) : {id: {in: []}};
  const visit = !can(actor,"appointments.view") ? {id: {in: []}} : requiresPatientAssignment(actor) ? {dentistId: actor.id} : {};
  const admission = !can(actor,"ipd.view") && !can(actor,"opd.view") ? {id: {in: []}} : requiresPatientAssignment(actor) ? {doctorId: actor.id} : {};
  const zone = selectedZone ?? await hospitalZone();
  const day = selectedDay ?? calendarDay(zone);
  const { start: today0, end: until } = await calendarBounds(day, day, zone);
  const { start: month0, end: monthEnd } = await calendarBounds(shiftMonth(day, 0), shiftDay(shiftMonth(day, 1), -1), zone);


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
    prisma.patient.count({where: patient}),
    prisma.appointment.count({ where: { ...visit, date: new Date(day) } }),
    prisma.appointment.count({ where: { ...visit, date: new Date(day), status: "COMPLETED" } }),
    prisma.appointment.count({
      where: {
        ...visit, date: new Date(day),
        status: { in: ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS"] },
      },
    }),
    can(actor,"billing.view") ? prisma.payment.aggregate({ _sum: { amount: true }, where: { date: { gte: today0, lt: until } } }) : Promise.resolve({_sum: {amount: null}}),
    can(actor,"billing.view") ? prisma.invoice.findMany({
      where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } },
      select: { total: true, payments: { select: { amount: true } } },
    }) : Promise.resolve([]),
    prisma.patient.count({ where: { ...patient, createdAt: { gte: month0, lt: monthEnd } } }),
    can(actor,"treatments.view") ? prisma.treatment.count({ where: { patient, status: { in: ["PLANNED", "IN_PROGRESS"] } } }) : Promise.resolve(0),
    prisma.encounter.count({ where: { appointment: {is: visit}, appointmentId: { not: null }, checkedInAt: { gte: today0, lt: until } } }),
    prisma.admission.count({ where: { ...admission, dischargedAt: null, status: { notIn:["REQUESTED","CANCELLED"] } } }),
    can(actor,"ipd.view") ? prisma.bed.groupBy({ by: ["status"], _count: true }) : Promise.resolve([]),
    prisma.appointment.findMany({ where: { ...visit, emergency: true, status: { in: ["CHECKED_IN","IN_PROGRESS"] } }, select: { patientId: true }, distinct: ["patientId"] }),
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
  if (!can(await requireUser(),"billing.view")) return [];
  const { zone, bounds, buckets } = await monthlyWindow(months);
  const payments = await prisma.payment.findMany({ where: { date: { gte: bounds.start, lt: bounds.end } }, select: { amount: true, date: true } });
  for (const payment of payments) {
    const key = calendarDay(zone, payment.date).slice(0, 7);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + toNumber(payment.amount));
  }
  return Array.from(buckets, ([month, revenue]) => ({ month: monthLabel(month), revenue }));
}

export async function getAppointmentStats() {
  if (!can(await requireUser(),"appointments.view")) return [];
  const actor = await requireUser();
  const scope = requiresPatientAssignment(actor) ? {dentistId: actor.id} : {};
  const today = calendarDay(await hospitalZone());
  const first = shiftDay(today, -6);
  const appointments = await prisma.appointment.findMany({
    where: { ...scope, date: { gte: new Date(first), lt: new Date(shiftDay(today, 1)) } },
    select: { date: true, status: true },
  });
  const buckets = new Map<string, { day: string; completed: number; cancelled: number; scheduled: number }>();
  for (let i = 0; i < 7; i++) {
    const key = shiftDay(first, i);
    buckets.set(key, { day: new Date(key).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }), completed: 0, cancelled: 0, scheduled: 0 });
  }
  for (const appointment of appointments) {
    const bucket = buckets.get(appointment.date.toISOString().slice(0, 10));
    if (!bucket) continue;
    if (appointment.status === "COMPLETED") bucket.completed++;
    else if (["CANCELLED", "NO_SHOW"].includes(appointment.status)) bucket.cancelled++;
    else bucket.scheduled++;
  }
  return Array.from(buckets.values());
}

export async function getPatientGrowth(months = 6) {
  if (!can(await requireUser(),"patients.view")) return [];
  const scope = patientScope(await requireUser());
  const { zone, bounds, buckets } = await monthlyWindow(months);
  const patients = await prisma.patient.findMany({ where: { ...scope, createdAt: { gte: bounds.start, lt: bounds.end } }, select: { createdAt: true } });
  for (const patient of patients) {
    const key = calendarDay(zone, patient.createdAt).slice(0, 7);
    if (buckets.has(key)) buckets.set(key, buckets.get(key)! + 1);
  }
  return Array.from(buckets, ([month, patients]) => ({ month: monthLabel(month), patients }));
}

export async function getTreatmentStats() {
  if (!can(await requireUser(),"treatments.view")) return [];
  const scope = patientScope(await requireUser());
  const grouped = await prisma.treatment.groupBy({
    where: {patient: scope},
    by: ["name"],
    _count: { _all: true },
    orderBy: { _count: { name: "desc" } },
    take: 6,
  });
  return grouped.map((g) => ({ name: g.name, count: g._count._all }));
}

export async function getTodayAppointments(day: string, dentistId?: string) {
  if (!can(await requireUser(),"appointments.view")) return [];
  return prisma.appointment.findMany({
    where: { date: new Date(day), dentistId },
    include: { patient: true, dentist: true },
    orderBy: { startTime: "asc" },
    take: 8,
  });
}

export async function getUpcomingAppointments(dentistId?: string) {
  if (!can(await requireUser(),"appointments.view")) return [];
  const tomorrow = new Date(shiftDay(calendarDay(await hospitalZone()), 1));
  return prisma.appointment.findMany({
    where: { dentistId, date: { gte: tomorrow }, status: { in: ["SCHEDULED", "CONFIRMED"] } },
    include: { patient: true, dentist: true },
    orderBy: { date: "asc" },
    take: 6,
  });
}

export async function getRecentPatients(dentistId?: string) {
  if (!can(await requireUser(),"patients.view")) return [];
  return prisma.patient.findMany({
    where: { archivedAt: null, ...(dentistId && { OR: [{ createdById: dentistId },{ appointments: { some: { dentistId } } },{ admissions: { some: { doctorId: dentistId } } }] }) }, orderBy: { createdAt: "desc" }, take: 6 });
}

export async function getRecentPayments() {
  if (!can(await requireUser(),"billing.view")) return [];
  return prisma.payment.findMany({
    include: { patient: true, invoice: true },
    orderBy: { date: "desc" },
    take: 6,
  });
}

export async function getOutstandingBalances() {
  if (!can(await requireUser(),"billing.view")) return [];
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
  const actor = await requireUser();
  if (requiresPatientAssignment(actor) || (!can(actor,"opd.manage") && !can(actor,"ipd.view"))) return [];
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
