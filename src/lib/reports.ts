export type ReportRange = "today" | "week" | "month" | "year" | "custom";

export function resolveRange(range: ReportRange, from?: string, to?: string) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (range === "custom" && from && to) {
    const start = new Date(`${from}T00:00:00`);
    const customEnd = new Date(`${to}T23:59:59`);
    return { start, end: customEnd };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (range === "week") {
    start.setDate(start.getDate() - start.getDay());
  } else if (range === "month") {
    start.setDate(1);
  } else if (range === "year") {
    start.setMonth(0, 1);
  }

  return { start, end };
}

export const RANGE_LABEL: Record<ReportRange, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  year: "This Year",
  custom: "Custom Range",
};
