export type CalendarView = "day" | "week" | "month";

export function parseDateParam(value?: string) {
  if (!value) return new Date();
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/**
 * `YYYY-MM-DD` from the date's *local* calendar day. (toISOString used the UTC day, so in
 * zones ahead of UTC a local midnight became the previous day: Day view's Next button
 * never moved and other navigation drifted.)
 */
export function toDateParam(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Key for an Appointment.date value: a Postgres DATE, which Prisma returns as UTC midnight. */
export function dbDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

export function endOfWeek(date: Date) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 6);
  return endOfDay(d);
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date: Date) {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function addDays(date: Date, n: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date: Date, n: number) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export function getRangeForView(view: CalendarView, date: Date) {
  if (view === "day") return { start: startOfDay(date), end: endOfDay(date) };
  if (view === "week") return { start: startOfWeek(date), end: endOfWeek(date) };
  // Month view grid includes the leading/trailing days of adjacent weeks.
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  return { start: startOfWeek(monthStart), end: endOfWeek(monthEnd) };
}

export function navigateDate(view: CalendarView, date: Date, direction: 1 | -1) {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addDays(date, direction * 7);
  return addMonths(date, direction);
}

export function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function rangeLabel(view: CalendarView, date: Date) {
  if (view === "day") {
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  if (view === "week") {
    const start = startOfWeek(date);
    const end = endOfWeek(date);
    const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  }
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}
