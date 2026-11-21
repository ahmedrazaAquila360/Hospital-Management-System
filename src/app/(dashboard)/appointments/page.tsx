import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Inbox, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getDentists, listAppointmentsInRange } from "@/server/appointments/queries";
import { countPendingRequests } from "@/server/appointment-requests/queries";
import { addDays, getRangeForView, parseDateParam, startOfWeek, toDateParam, type CalendarView } from "@/lib/calendar";
import { CalendarToolbar } from "@/components/appointments/calendar-toolbar";
import { MonthView } from "@/components/appointments/month-view";
import { TimeGrid } from "@/components/appointments/time-grid";
import { matchesQuery, toCalendarEvents } from "@/components/appointments/calendar-events";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { APPOINTMENT_STATUSES } from "@/lib/validations/appointment";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/shared/page-header";
import { getWorkingHours } from "@/server/settings/queries";
import { weekHourRange } from "@/lib/working-hours";

export const metadata: Metadata = { title: "Appointments" };

type SearchParams = Promise<{ view?: string; date?: string; dentistId?: string; status?: string; q?: string }>;

export default async function AppointmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("appointments.view");
  const params = await searchParams;
  // Both linked pages (new booking, website requests) require appointments.manage.
  const canCreate = can(user, "appointments.create");
  const canEdit = can(user, "appointments.edit");
  const canRequests = can(user, "appointments.requests");

  const view = (["day", "week", "month"].includes(params.view ?? "") ? params.view : "week") as CalendarView;
  const date = parseDateParam(params.date);
  const { start, end } = getRangeForView(view, date);
  // An unknown status would reach Prisma as an invalid enum and fail the page.
  const status = APPOINTMENT_STATUSES.find((s) => s === params.status) as AppointmentStatus | undefined;

  const [dentistUsers, appointments, pendingRequests, workingHours] = await Promise.all([
    getDentists(),
    listAppointmentsInRange(start, end, { dentistId: params.dentistId || undefined, status }),
    canRequests ? countPendingRequests() : Promise.resolve(0),
    getWorkingHours(),
  ]);
  const dentists = dentistUsers.map((d) => ({ id: d.id, name: d.name }));
  const events = toCalendarEvents(appointments.filter((a) => matchesQuery(a, params.q ?? "")));

  const days =
    view === "day" ? [date] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(date), i)) : [];
  // The query range can include an extra day on either edge; count only what is drawn.
  const drawnKeys = new Set(days.map(toDateParam));
  const count =
    view === "month"
      ? events.filter((e) => e.dayKey.slice(0, 7) === toDateParam(date).slice(0, 7)).length
      : events.filter((e) => drawnKeys.has(e.dayKey)).length;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        icon={<CalendarDays />}
        title="Appointments"
        description="Manage bookings, check-ins, and the daily schedule."
        actions={
          (canRequests || canCreate) && (
            <>
              {canRequests && (
                <Button asChild variant="outline" className="sm:h-10 sm:px-4">
                  <Link href="/appointments/requests">
                    <Inbox /> Website Requests
                    {pendingRequests > 0 && <Badge className="ml-1">{pendingRequests}</Badge>}
                  </Link>
                </Button>
              )}
              {canCreate && (
                <Button asChild className="sm:h-10 sm:px-4">
                  <Link href="/appointments/new">
                    <Plus /> Add Appointment
                  </Link>
                </Button>
              )}
            </>
          )
        }
      />

      <CalendarToolbar view={view} dateParam={toDateParam(date)} dentists={dentists} count={count} />

      {view === "month" ? (
        <MonthView month={date} events={events} />
      ) : (
        <TimeGrid days={days} events={events} mode={view} canManage={canCreate} canEdit={canEdit} hourRange={weekHourRange(workingHours)} />
      )}
    </div>
  );
}
