import Link from "next/link";
import { CalendarPlus, CalendarX2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppointmentHoverCard } from "@/components/appointments/appointment-hover-card";
import { AppointmentQuickActions } from "@/components/appointments/appointment-quick-actions";
import { StatusBadge } from "@/components/shared/status-badge";
import { isInactiveStatus, typeStyle } from "@/components/appointments/appointment-style";
import type { CalendarEvent } from "@/components/appointments/calendar-events";
import { isSameDay, toDateParam } from "@/lib/calendar";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 18;

type Placed = CalendarEvent & { lane: number; lanes: number };

/** Side-by-side lanes for overlapping visits (each overlap cluster splits its width). */
function placeEvents(events: CalendarEvent[]): Placed[] {
  const sorted = [...events].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = -1;
  let laneEnds: number[] = [];

  const flush = () => {
    for (const e of cluster) e.lanes = laneEnds.length;
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };

  for (const e of sorted) {
    if (cluster.length && e.startMin >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= e.startMin);
    if (lane === -1) lane = laneEnds.push(e.endMin) - 1;
    else laneEnds[lane] = e.endMin;
    cluster.push({ ...e, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, e.endMin);
  }
  flush();
  return placed;
}

function hourLabel(hour: number) {
  const h = hour % 24;
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${suffix}`;
}

/**
 * Week / day schedule: an hourly grid with each appointment placed by its real start time
 * and length. Hours default to 8 AM–6 PM and stretch to fit anything earlier or later.
 * One scroll container keeps the day header and time gutter pinned on small screens.
 */
export function TimeGrid({
  days,
  events,
  mode,
  canManage,
  canEdit = false,
  hourRange,
}: {
  days: Date[];
  events: CalendarEvent[];
  mode: "week" | "day";
  canManage: boolean;
  /** Status / reschedule menu on each appointment (appointments.edit). */
  canEdit?: boolean;
  /** Earliest opening / latest closing hour from Settings → Working Hours. */
  hourRange?: { start: number; end: number } | null;
}) {
  const hourHeight = mode === "day" ? 96 : 76;
  const startHour = Math.min(hourRange?.start ?? DEFAULT_START_HOUR, ...events.map((e) => Math.floor(e.startMin / 60)));
  const endHour = Math.max(hourRange?.end ?? DEFAULT_END_HOUR, ...events.map((e) => Math.ceil(e.endMin / 60)));
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const bodyHeight = hours.length * hourHeight;
  const today = new Date();

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.dayKey, [...(byDay.get(e.dayKey) ?? []), e]);

  const columns = mode === "day" ? "4.5rem minmax(0,1fr)" : "4.5rem repeat(7, minmax(8.75rem, 1fr))";

  return (
    // contain-inline-size: the week grid has a ~66rem minimum width; without containment that
    // minimum propagated up and widened the dashboard's <main>, so tablets scrolled the whole
    // page sideways instead of just the calendar.
    <div className="surface-card min-w-0 overflow-hidden p-0 [contain:inline-size]">
      <div className="max-h-[max(30rem,calc(100svh-15.5rem))] overflow-auto overscroll-contain">
        <div className={cn("grid", mode === "week" && "min-w-[65.75rem]")} style={{ gridTemplateColumns: columns }}>
          {/* Header row */}
          <div className="bg-card/95 border-border/70 sticky top-0 left-0 z-30 border-r border-b backdrop-blur" />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={`h-${day.toISOString()}`}
                className={cn(
                  "border-border/70 sticky top-0 z-20 border-b px-2 py-3 text-center backdrop-blur not-last:border-r",
                  isToday ? "bg-pale/95" : "bg-card/95"
                )}
              >
                <p className={cn("text-sm font-semibold", isToday ? "text-brand" : "text-navy")}>
                  {day.toLocaleDateString("en-US", { weekday: mode === "day" ? "long" : "short" })}
                </p>
                <p
                  className={cn(
                    "mt-0.5 inline-flex items-center rounded-full px-2 text-xs",
                    isToday ? "bg-brand text-white font-semibold" : "text-muted-foreground"
                  )}
                >
                  {day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
            );
          })}

          {/* Time gutter */}
          <div className="bg-card border-border/70 sticky left-0 z-10 border-r" style={{ height: bodyHeight }}>
            {hours.map((h, i) => (
              <span
                key={h}
                className={cn(
                  "text-muted-foreground absolute right-2 text-[11px] font-medium whitespace-nowrap tabular-nums",
                  i > 0 && "-translate-y-1/2"
                )}
                style={{ top: i === 0 ? 4 : i * hourHeight }}
              >
                {hourLabel(h)}
              </span>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const key = toDateParam(day);
            const dayEvents = placeEvents(byDay.get(key) ?? []);
            const isToday = isSameDay(day, today);
            return (
              <div
                key={key}
                className={cn("border-border/70 relative not-last:border-r", isToday && "bg-pale/35")}
                style={{
                  height: bodyHeight,
                  backgroundImage:
                    "linear-gradient(to bottom, var(--border) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--border) 45%, transparent) 1px, transparent 1px)",
                  backgroundSize: `100% ${hourHeight}px, 100% ${hourHeight / 2}px`,
                }}
              >
                {dayEvents.length === 0 ? (
                  <EmptyDay date={key} canManage={canManage} mode={mode} />
                ) : (
                  dayEvents.map((e) => (
                    <EventCard
                      key={e.id}
                      event={e}
                      top={((e.startMin - startHour * 60) / 60) * hourHeight}
                      height={Math.max(((e.endMin - e.startMin) / 60) * hourHeight, 26)}
                      mode={mode}
                      canEdit={canEdit}
                    />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EventCard({ event: e, top, height, mode, canEdit }: { event: Placed; top: number; height: number; mode: "week" | "day"; canEdit: boolean }) {
  const style = typeStyle(e.type);
  const inactive = isInactiveStatus(e.status);
  // Enough height for time, type and patient on separate lines.
  const roomy = height >= (mode === "day" ? 70 : 58);
  const width = `calc(${100 / e.lanes}% - 6px)`;
  const left = `calc(${(100 / e.lanes) * e.lane}% + 3px)`;

  return (
    <AppointmentHoverCard event={e}>
    <div
      className={cn(
        "group absolute z-[1] overflow-hidden rounded-lg border px-2 text-left shadow-xs transition-[box-shadow,transform] hover:z-[2] hover:shadow-md focus-within:z-[2]",
        roomy ? "py-1.5" : "py-0.5",
        // Room for the status badge + actions menu pinned top-right in Day view.
        mode === "day" && (height >= 40 ? "pr-10 sm:pr-32" : "pr-10"),
        style.card,
        inactive && "opacity-60"
      )}
      style={{ top: top + 1, height: height - 2, width, left }}
    >
      <Link
        href={`/appointments/${e.id}`}
        className="focus-visible:ring-ring/60 block h-full rounded-md outline-none after:absolute after:inset-0 focus-visible:ring-2"
        aria-label={`${e.typeLabel} with ${e.patientName}, ${e.timeLabel}, ${e.statusLabel}`}
      >
        <span className={cn("flex items-center gap-1.5 text-[11px] font-semibold text-navy tabular-nums", inactive && "line-through")}>
          <span className={cn("size-2 shrink-0 rounded-full", style.dot)} aria-hidden />
          <span className="truncate">{roomy || mode === "day" ? e.timeLabel : e.timeLabel.split(" – ")[0]}</span>
        </span>
        {roomy ? (
          <>
            <span className="text-navy mt-0.5 block truncate text-[13px] leading-tight font-semibold">{e.typeLabel}</span>
            <span className="text-foreground/70 block truncate text-xs">
              {e.patientName}
              {mode === "day" && <span className="text-muted-foreground"> · {e.dentistName}</span>}
            </span>
          </>
        ) : (
          <span className={cn("text-foreground/75 block truncate", mode === "day" ? "mt-0.5 text-xs" : "text-[11px]")}>
            <span className={cn(mode === "day" && "text-navy font-semibold")}>{e.typeLabel}</span> · {e.patientName}
            {mode === "day" && <span className="text-muted-foreground"> · {e.dentistName}</span>}
          </span>
        )}
        {height >= 88 && mode === "week" && (
          <span className="text-muted-foreground mt-1 block truncate text-[11px]">{e.statusLabel}</span>
        )}
      </Link>
      {mode === "day" && (
        <div className="absolute top-1 right-1 z-[3] flex items-center gap-1.5">
          {height >= 40 && (
            <StatusBadge
              status={e.status}
              tone={APPOINTMENT_STATUS_TONE[e.status]}
              className="hidden px-1.5 py-0 text-[10px] sm:inline-flex"
            />
          )}
          {canEdit && <AppointmentQuickActions id={e.id} status={e.status} />}
        </div>
      )}
    </div>
    </AppointmentHoverCard>
  );
}

function EmptyDay({ date, canManage, mode }: { date: string; canManage: boolean; mode: "week" | "day" }) {
  return (
    <div className="sticky top-24 flex flex-col items-center gap-2 px-2 pt-16 text-center">
      <span className="bg-muted/70 text-muted-foreground flex size-11 items-center justify-center rounded-xl">
        {mode === "day" ? <CalendarX2 className="size-5" aria-hidden /> : <CalendarPlus className="size-5" aria-hidden />}
      </span>
      <p className="text-muted-foreground text-xs font-medium">
        {mode === "day" ? "No appointments this day" : "No appointments"}
      </p>
      {canManage && (
        <Button asChild variant="outline" size="sm" className="bg-card mt-1 rounded-full">
          <Link href={`/appointments/new?date=${date}`} aria-label={`Add appointment on ${date}`}>
            <Plus /> Add
          </Link>
        </Button>
      )}
    </div>
  );
}
