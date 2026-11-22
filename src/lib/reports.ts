import { calendarDay, shiftDay, validDay } from "./report-calendar";

export type ReportRange = "today" | "week" | "month" | "year" | "custom";

export function resolveRange(range: ReportRange, from?: string, to?: string, zone = "UTC", now = new Date()) {
  const today = calendarDay(zone, now);
  let first = today;
  let last = today;
  if (range === "custom" && validDay(from) && validDay(to) && from <= to) {
    first = from;
    last = to;
  } else if (range === "week") {
    first = shiftDay(today, -new Date(today).getUTCDay());
  } else if (range === "month") {
    first = today.slice(0, 7) + "-01";
  } else if (range === "year") {
    first = today.slice(0, 4) + "-01-01";
  }
  return { first, last, start: new Date(first), end: new Date(shiftDay(last, 1)) };
}

export const RANGE_LABEL: Record<ReportRange, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom Range",
};
