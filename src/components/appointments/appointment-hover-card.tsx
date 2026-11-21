"use client";

import type { ReactNode } from "react";
import { CalendarDays, ChevronRight, Clock3, Hourglass, NotebookPen, Phone, Stethoscope, UserRound } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { typeStyle } from "@/components/appointments/appointment-style";
import { cn } from "@/lib/utils";
import type { CalendarEvent } from "@/components/appointments/calendar-events";

const STATUS_STYLE: Record<string, string> = {
  SCHEDULED: "bg-blue-50 text-blue-700 ring-blue-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CHECKED_IN: "bg-cyan-50 text-cyan-800 ring-cyan-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 ring-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
  NO_SHOW: "bg-rose-50 text-rose-700 ring-rose-200",
};

/**
 * Appointment preview on hover / keyboard focus, replacing the browser's plain `title`
 * tooltip on calendar entries. Clicking the entry still opens the appointment.
 */
export function AppointmentHoverCard({ event: e, children }: { event: CalendarEvent; children: ReactNode }) {
  const style = typeStyle(e.type);
  return (
    <HoverCard>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="right" className="w-80 overflow-hidden p-0">
        <div className={cn("h-1.5 w-full", style.dot)} aria-hidden />
        <div className="space-y-3.5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold", style.pill)}>
                <span className={cn("size-1.5 rounded-full", style.dot)} aria-hidden />
                {e.typeLabel}
              </p>
              <p className="text-navy mt-1.5 truncate text-base leading-tight font-semibold">{e.patientName}</p>
              <p className="text-muted-foreground text-xs tabular-nums">{e.patientCode}</p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset",
                STATUS_STYLE[e.status] ?? STATUS_STYLE.SCHEDULED
              )}
            >
              {e.statusLabel}
            </span>
          </div>

          <dl className="bg-muted/40 grid gap-2 rounded-xl p-3 text-sm">
            <Row icon={CalendarDays} label="Date">
              {e.dateLabel}
            </Row>
            <Row icon={Clock3} label="Time">
              <span className="tabular-nums">{e.timeLabel}</span>
            </Row>
            <Row icon={Hourglass} label="Duration">
              {e.durationLabel}
            </Row>
            <Row icon={Stethoscope} label="Dentist">
              {e.dentistName}
            </Row>
            <Row icon={Phone} label="Phone">
              <span className="tabular-nums">{e.patientPhone}</span>
            </Row>
          </dl>

          {e.notes && (
            <p className="text-foreground/75 flex gap-2 text-xs leading-relaxed">
              <NotebookPen className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-3">{e.notes}</span>
            </p>
          )}

          <p className="text-brand border-border/70 flex items-center justify-between border-t pt-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <UserRound className="size-3.5" aria-hidden /> Click to open the appointment
            </span>
            <ChevronRight className="size-3.5" aria-hidden />
          </p>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({ icon: Icon, label, children }: { icon: typeof Clock3; label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[1.25rem_4.25rem_minmax(0,1fr)] items-center gap-1">
      <Icon className="text-brand size-3.5" aria-hidden />
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-navy truncate font-medium">{children}</dd>
    </div>
  );
}
