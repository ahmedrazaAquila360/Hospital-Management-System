import Link from "next/link";
import { addDays, isSameDay, startOfMonth, startOfWeek, toDateParam } from "@/lib/calendar";
import { isInactiveStatus, typeStyle } from "@/components/appointments/appointment-style";
import { AppointmentHoverCard } from "@/components/appointments/appointment-hover-card";
import type { CalendarEvent } from "@/components/appointments/calendar-events";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_VISIBLE = 3;

/**
 * Month grid. Each pill opens its appointment, the day number (and "+N more") opens that day
 * in Day view. Phones get coloured dots instead of pills.
 */
export function MonthView({ month, events }: { month: Date; events: CalendarEvent[] }) {
  const gridStart = startOfWeek(startOfMonth(month));
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  // Drop a trailing week that is entirely next month.
  const visibleDays = days[35].getMonth() !== month.getMonth() ? days.slice(0, 35) : days;
  const today = new Date();

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) byDay.set(e.dayKey, [...(byDay.get(e.dayKey) ?? []), e]);

  return (
    <div className="surface-card overflow-hidden p-0">
      <div className="bg-muted/40 border-border/70 grid grid-cols-7 border-b">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-muted-foreground px-2 py-2.5 text-center text-xs font-semibold">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {visibleDays.map((day, i) => {
          const key = toDateParam(day);
          const dayEvents = [...(byDay.get(key) ?? [])].sort((a, b) => a.startMin - b.startMin);
          const inMonth = day.getMonth() === month.getMonth();
          const isToday = isSameDay(day, today);
          const visible = dayEvents.slice(0, MAX_VISIBLE);
          const overflow = dayEvents.length - visible.length;
          const dayHref = `/appointments?view=day&date=${key}`;

          return (
            <div
              key={key}
              className={cn(
                "border-border/70 flex min-h-20 flex-col gap-1 border-b p-1.5 sm:min-h-32 sm:p-2",
                (i + 1) % 7 !== 0 && "border-r",
                !inMonth && "bg-muted/25",
                isToday && "bg-pale/50"
              )}
            >
              <Link
                href={dayHref}
                aria-label={`${day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}, ${dayEvents.length} appointment${dayEvents.length === 1 ? "" : "s"}`}
                className={cn(
                  "hover:bg-pale focus-visible:ring-ring/60 flex size-7 items-center justify-center self-start rounded-full text-xs font-semibold outline-none focus-visible:ring-2",
                  inMonth ? "text-navy" : "text-muted-foreground/60",
                  isToday && "bg-brand hover:bg-brand text-white"
                )}
              >
                {day.getDate()}
              </Link>

              {/* Phones: dots only */}
              {dayEvents.length > 0 && (
                <Link href={dayHref} className="flex flex-wrap gap-1 px-1 sm:hidden" aria-hidden tabIndex={-1}>
                  {dayEvents.slice(0, 4).map((e) => (
                    <span key={e.id} className={cn("size-1.5 rounded-full", typeStyle(e.type).dot, isInactiveStatus(e.status) && "opacity-40")} />
                  ))}
                </Link>
              )}

              <div className="hidden flex-col gap-1 sm:flex">
                {visible.map((e) => (
                  <AppointmentHoverCard key={e.id} event={e}>
                  <Link
                    href={`/appointments/${e.id}`}
                    className={cn(
                      "flex items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-[11px] font-medium transition-[filter] hover:brightness-95",
                      typeStyle(e.type).pill,
                      isInactiveStatus(e.status) && "line-through opacity-60"
                    )}
                  >
                    <span className={cn("size-1.5 shrink-0 rounded-full", typeStyle(e.type).dot)} aria-hidden />
                    <span className="truncate">
                      <span className="tabular-nums">{e.timeLabel.split(" – ")[0]}</span> {e.patientName}
                    </span>
                  </Link>
                  </AppointmentHoverCard>
                ))}
                {overflow > 0 && (
                  <Link href={dayHref} className="text-brand px-1.5 text-[11px] font-medium hover:underline">
                    +{overflow} more
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
