import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getDepartmentCensus } from "@/server/dashboard/queries";
import { getClinicSettings } from "@/server/settings/queries";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import {
  getAppointmentStats,
  getDashboardStats,
  getOutstandingBalances,
  getPatientGrowth,
  getRecentPatients,
  getRecentPayments,
  getRevenueOverview,
  getTodayAppointments,
  getTreatmentStats,
  getUpcomingAppointments,
} from "@/server/dashboard/queries";
import { StatGrid, type StatEntry } from "@/components/dashboard/stat-grid";
import { RevenueChart } from "@/components/dashboard/charts/revenue-chart";
import { AppointmentStatsChart } from "@/components/dashboard/charts/appointment-stats-chart";
import { PatientGrowthChart } from "@/components/dashboard/charts/patient-growth-chart";
import { TreatmentStatsChart } from "@/components/dashboard/charts/treatment-stats-chart";
import { AppointmentListPanel } from "@/components/dashboard/panels/appointment-list-panel";
import { RecentPatientsPanel } from "@/components/dashboard/panels/recent-patients-panel";
import { RecentPaymentsPanel } from "@/components/dashboard/panels/recent-payments-panel";
import { OutstandingBalancesPanel } from "@/components/dashboard/panels/outstanding-balances-panel";
import { ClinicTodayCard } from "@/components/dashboard/clinic-today-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { CalendarPlus, UserPlus } from "lucide-react";
import Link from "next/link";
import { can } from "@/lib/permissions";
import { formatCurrency, formatDate } from "@/lib/format";

/** "Dr. Sarah Chen" → "Dr. Chen"; anyone else is greeted by first name. */
function greetingName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (/^dr\.?$/i.test(parts[0] ?? "") && parts.length > 1) return `Dr. ${parts[parts.length - 1]}`;
  return parts[0] ?? name;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ from?: string; through?: string }> }) {
  const user = await requireUser();

  if (!can(user, "dashboard.view")) {
    for (const [permission, href] of [["pharmacy.view","/pharmacy"], ["lab.view","/laboratory"], ["ipd.view","/admissions"], ["billing.view","/billing/invoices"], ["settings.view","/settings"]] as const) {
      if (can(user, permission)) redirect(href);
    }
    redirect("/no-access?permission=dashboard.view");
  }
  const settings = await getClinicSettings();
  const params = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timeZone, year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date());
  const from = z.iso.date().safeParse(params.from).data ?? today.slice(0,7) + "-01";
  const through = z.iso.date().safeParse(params.through).data ?? today;
  const census = through >= from ? await getDepartmentCensus(from,through) : [];
  const activities = await prisma.activityLog.findMany({ where: can(user,"permissions.edit") ? {} : { userId: user.id }, select: { id:true,action:true,entityType:true,createdAt:true }, orderBy: { createdAt:"desc" }, take:8 });
  const [
    stats,
    revenue,
    appointmentStats,
    patientGrowth,
    treatmentStats,
    todayAppointments,
    upcomingAppointments,
    recentPatients,
    recentPayments,
    outstandingBalances,
  ] = await Promise.all([
    getDashboardStats(today,settings.timeZone),
    getRevenueOverview(),
    getAppointmentStats(),
    getPatientGrowth(),
    getTreatmentStats(),
    getTodayAppointments(today,user.role.name === "DENTIST" ? user.id : undefined),
    getUpcomingAppointments(user.role.name === "DENTIST" ? user.id : undefined),
    can(user,"patients.view") ? getRecentPatients(user.role.name === "DENTIST" ? user.id : undefined) : [],
    can(user,"billing.view") ? getRecentPayments() : [],
    can(user,"billing.view") ? getOutstandingBalances() : [],
  ]);

  const statEntries: StatEntry[] = [
    { label: "Total Patients", value: stats.totalPatients.toString(), icon: "users", tone: "primary" },
    { label: "Today's Appointments", value: stats.todayAppointments.toString(), icon: "calendar-days", tone: "primary" },
    { label: "Completed Today", value: stats.completedAppointmentsToday.toString(), icon: "check-circle", tone: "success" },
    { label: "Pending Today", value: stats.pendingAppointmentsToday.toString(), icon: "clock", tone: "warning" },
    { label: "Today's Revenue", value: formatCurrency(stats.todayRevenue,settings.currency), icon: "circle-dollar-sign", tone: "success" },
    { label: "Outstanding Payments", value: formatCurrency(stats.outstandingPayments,settings.currency), icon: "triangle-alert", tone: "destructive" },
    { label: "New Patients", value: stats.newPatientsThisMonth.toString(), icon: "user-round-plus", hint: "This month", tone: "primary" },
    { label: "Emergency patients", value: String(stats.emergencies), icon: "stethoscope", tone: "warning" },
    { label: "OPD visits today", value: String(stats.opdVisits), icon: "stethoscope" },
    { label: "Active admissions", value: String(stats.admissions), icon: "users" },
    { label: "Beds available", value: String(stats.available), icon: "check-circle" },
    { label: "Beds occupied", value: String(stats.occupied), icon: "users" },
    { label: "Bed occupancy", value: stats.bedCount ? Math.round(100 * stats.occupied / stats.bedCount) + "%" : "—", icon: "stethoscope" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={formatDate(new Date(), "EEEE, MMMM d")}
        title={<>Welcome back, {greetingName(user.name)}</>}
        description="Here's what's happening at your hospital today."
        actions={
          <>
            {can(user, "patients.create") && (
              <Button asChild variant="outline">
                <Link href="/patients/new">
                  <UserPlus /> Add Patient
                </Link>
              </Button>
            )}
            {can(user, "appointments.create") && (
              <Button asChild>
                <Link href="/appointments/new">
                  <CalendarPlus /> Book Appointment
                </Link>
              </Button>
            )}
          </>
        }
      />

      <StatGrid stats={statEntries.filter(s => can(user,"billing.view") || !["Today's Revenue","Outstanding Payments"].includes(s.label))} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-5">
        {can(user,"billing.view") && <RevenueChart data={revenue} />}
        <ClinicTodayCard
          dateLabel={formatDate(new Date(), "EEEE, MMM d")}
          total={stats.todayAppointments}
          completed={stats.completedAppointmentsToday}
          pending={stats.pendingAppointmentsToday}
          activeTreatments={stats.activeTreatments}
          canOpenChart={can(user, "opd.view")}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
        <PatientGrowthChart data={patientGrowth} />
        <AppointmentStatsChart data={appointmentStats} />
        <div className="md:col-span-2 xl:col-span-1">
          <TreatmentStatsChart data={treatmentStats} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:gap-5 xl:grid-cols-3">
        <AppointmentListPanel
          title="Today's Appointments"
          appointments={todayAppointments}
          variant="table"
          className="xl:col-span-2"
        />
        <RecentPatientsPanel patients={recentPatients} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:gap-5 xl:grid-cols-3">
        <AppointmentListPanel title="Upcoming Appointments" appointments={upcomingAppointments} showDate />
        {can(user,"billing.view") && <RecentPaymentsPanel payments={recentPayments} />}
        <div className="md:col-span-2 xl:col-span-1">
          {can(user,"billing.view") && <OutstandingBalancesPanel invoices={outstandingBalances} />}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2"><section className="surface-card space-y-4 p-5"><h3 className="font-semibold">Patients by department</h3>
        <form className="flex flex-wrap items-end gap-2"><label>From<input className="block rounded-md border p-2" name="from" type="date" defaultValue={from}/></label><label>Through<input className="block rounded-md border p-2" name="through" type="date" defaultValue={through}/></label><Button variant="outline">Apply</Button></form>
        {through < from ? <p>Choose an end date on or after the start date.</p> : <table className="w-full text-left text-sm"><thead><tr><th>Department</th><th>Patients</th><th>Visits and admissions</th></tr></thead><tbody>{census.map(row=><tr key={row.name}><td>{row.name}</td><td>{row.patients}</td><td>{row.visits}</td></tr>)}</tbody></table>}</section>
        <section className="surface-card space-y-2 p-5"><h3 className="font-semibold">Recent activity</h3>{activities.map(a=><p className="text-sm" key={a.id}>{a.createdAt.toLocaleString()} · {a.entityType} · {a.action.toLowerCase()}</p>)}</section></div>
    </div>
  );
}
