import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/shared/status-badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PanelCard } from "@/components/dashboard/panels/panel-card";
import { formatDate, formatTime, initialsFromName } from "@/lib/format";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/labels";
import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { getTodayAppointments } from "@/server/dashboard/queries";

type Appointment = Awaited<ReturnType<typeof getTodayAppointments>>[number];

function dentistName(name: string) {
  return `Dr. ${name.replace(/^Dr\.\s*/, "")}`;
}

export function AppointmentListPanel({
  title,
  appointments,
  showDate = false,
  variant = "list",
  className,
}: {
  title: string;
  appointments: Appointment[];
  showDate?: boolean;
  /** "table" lays visits out in columns (time · patient · visit type · dentist · status). */
  variant?: "list" | "table";
  className?: string;
}) {
  return (
    <PanelCard title={title} viewAllHref="/appointments" className={className}>
      {appointments.length === 0 ? (
        <Empty>
          <EmptyMedia variant="icon">
            <CalendarX2 />
          </EmptyMedia>
          <EmptyTitle>No appointments</EmptyTitle>
          <EmptyDescription>Nothing scheduled here right now.</EmptyDescription>
        </Empty>
      ) : variant === "table" ? (
        <div className="-mx-1 overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="text-muted-foreground grid grid-cols-[84px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_112px] gap-3 rounded-lg bg-[#f7fafd] px-3 py-2 text-[11px] font-semibold tracking-[0.06em] uppercase">
              <span>Time</span>
              <span>Patient</span>
              <span>Visit</span>
              <span>Dentist</span>
              <span>Status</span>
            </div>
            <ul className="divide-border/70 divide-y">
              {appointments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/appointments/${a.id}`}
                    className="hover:bg-pale/60 grid grid-cols-[84px_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_112px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors"
                  >
                    <span className="text-navy font-semibold tabular">{formatTime(a.startTime)}</span>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-[11px] font-semibold text-navy">
                          {initialsFromName(a.patient.fullName)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{a.patient.fullName}</span>
                        <span className="text-muted-foreground block truncate text-xs">{a.patient.patientCode}</span>
                      </span>
                    </span>
                    <span className="text-muted-foreground truncate">{APPOINTMENT_TYPE_LABEL[a.type] ?? a.type}</span>
                    <span className="text-muted-foreground truncate">{dentistName(a.dentist.name)}</span>
                    <span>
                      <StatusBadge status={a.status} tone={APPOINTMENT_STATUS_TONE[a.status]} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <ul className="-mx-2">
          {appointments.map((a) => (
            <li key={a.id}>
              <Link
                href={`/appointments/${a.id}`}
                className="hover:bg-pale/60 flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors"
              >
                {showDate ? (
                  <span className="bg-pale text-navy flex size-10 shrink-0 flex-col items-center justify-center rounded-xl ring-1 ring-[#d3e8f5] ring-inset">
                    <span className="text-[10px] leading-none font-semibold uppercase opacity-70">{formatDate(a.date, "MMM")}</span>
                    <span className="font-heading text-sm leading-tight font-semibold">{formatDate(a.date, "d")}</span>
                  </span>
                ) : (
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold text-navy">
                      {initialsFromName(a.patient.fullName)}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{a.patient.fullName}</p>
                  <p className={cn("text-muted-foreground truncate text-xs")}>
                    {formatTime(a.startTime)} · {dentistName(a.dentist.name)}
                  </p>
                </div>
                <StatusBadge status={a.status} tone={APPOINTMENT_STATUS_TONE[a.status]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
