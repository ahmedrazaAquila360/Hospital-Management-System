/**
 * Clinic working hours, stored in ClinicSettings.workingHours (JSON). Each day is either
 * closed or has one or more shifts, e.g. a morning shift 08:00–12:00 and an evening shift
 * 16:00–22:00. The older one-range format ({ open, close } per day) is still read.
 */

export const WEEK_DAYS = [
  { key: "mon", label: "Monday", jsDay: 1 },
  { key: "tue", label: "Tuesday", jsDay: 2 },
  { key: "wed", label: "Wednesday", jsDay: 3 },
  { key: "thu", label: "Thursday", jsDay: 4 },
  { key: "fri", label: "Friday", jsDay: 5 },
  { key: "sat", label: "Saturday", jsDay: 6 },
  { key: "sun", label: "Sunday", jsDay: 0 },
] as const;

export type DayKey = (typeof WEEK_DAYS)[number]["key"];
export type Shift = { open: string; close: string };
export type DayHours = { closed: boolean; shifts: Shift[] };
export type WorkingHours = Record<DayKey, DayHours>;

export const MAX_SHIFTS = 3;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { closed: false, shifts: [{ open: "09:00", close: "18:00" }] },
  tue: { closed: false, shifts: [{ open: "09:00", close: "18:00" }] },
  wed: { closed: false, shifts: [{ open: "09:00", close: "18:00" }] },
  thu: { closed: false, shifts: [{ open: "09:00", close: "18:00" }] },
  fri: { closed: false, shifts: [{ open: "09:00", close: "18:00" }] },
  sat: { closed: false, shifts: [{ open: "10:00", close: "14:00" }] },
  sun: { closed: true, shifts: [] },
};

/** Normalises whatever is stored (new or old format). `null` when nothing is configured. */
export function parseWorkingHours(raw: unknown): WorkingHours | null {
  if (!raw || typeof raw !== "object") return null;
  const src = raw as Record<string, unknown>;
  const out = {} as WorkingHours;
  let any = false;
  for (const { key } of WEEK_DAYS) {
    const day = src[key] as { closed?: boolean; shifts?: Shift[]; open?: string; close?: string } | undefined;
    if (!day) {
      out[key] = { closed: true, shifts: [] };
      continue;
    }
    any = true;
    const shifts = Array.isArray(day.shifts)
      ? day.shifts.filter((s) => s && TIME.test(s.open) && TIME.test(s.close))
      : day.open && day.close && TIME.test(day.open) && TIME.test(day.close)
        ? [{ open: day.open, close: day.close }]
        : [];
    out[key] = { closed: Boolean(day.closed) || shifts.length === 0, shifts: [...shifts].sort((a, b) => a.open.localeCompare(b.open)) };
  }
  return any ? out : null;
}

/** First problem with the hours as entered, or null when they can be saved. */
export function validateWorkingHours(hours: WorkingHours): string | null {
  for (const { key, label } of WEEK_DAYS) {
    const day = hours[key];
    if (!day || day.closed) continue;
    if (day.shifts.length === 0) return `${label}: add at least one shift or mark the day closed.`;
    if (day.shifts.length > MAX_SHIFTS) return `${label}: up to ${MAX_SHIFTS} shifts per day.`;
    const sorted = [...day.shifts].sort((a, b) => a.open.localeCompare(b.open));
    for (let i = 0; i < sorted.length; i++) {
      const s = sorted[i];
      if (!TIME.test(s.open) || !TIME.test(s.close)) return `${label}: enter both an opening and a closing time.`;
      if (s.close <= s.open) return `${label}: closing time must be after opening time (${formatTime(s.open)}).`;
      if (i > 0 && s.open < sorted[i - 1].close) return `${label}: shifts overlap — the next shift must start after ${formatTime(sorted[i - 1].close)}.`;
    }
  }
  return null;
}

/** Stored shape: closed days keep no shifts; shifts are sorted. */
export function normaliseForStorage(hours: WorkingHours): WorkingHours {
  const out = {} as WorkingHours;
  for (const { key } of WEEK_DAYS) {
    const day = hours[key];
    out[key] = day.closed
      ? { closed: true, shifts: [] }
      : { closed: false, shifts: [...day.shifts].sort((a, b) => a.open.localeCompare(b.open)) };
  }
  return out;
}

/** "YYYY-MM-DD" → that weekday's entry (parsed as a calendar date, so no time-zone shift). */
export function dayFor(hours: WorkingHours, date: string) {
  const [y, m, d] = date.split("-").map(Number);
  const jsDay = new Date(y, (m ?? 1) - 1, d ?? 1).getDay();
  const meta = WEEK_DAYS.find((w) => w.jsDay === jsDay)!;
  return { ...meta, hours: hours[meta.key] };
}

/**
 * Why an appointment on `date` from `start` to `end` (HH:mm) falls outside the clinic's hours,
 * or null when it fits inside one shift. No configured hours means no restriction.
 */
export function workingHoursProblem(hours: WorkingHours | null, date: string, start: string, end: string): string | null {
  if (!hours || !date || !start || !end) return null;
  const { label, hours: day } = dayFor(hours, date);
  if (day.closed) return `The clinic is closed on ${label}s.`;
  if (day.shifts.some((s) => start >= s.open && end <= s.close)) return null;
  return `Outside working hours. ${label}: ${formatShifts(day)}.`;
}

/** "16:00" → "4:00 PM". */
export function formatTime(value: string) {
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatShifts(day: DayHours) {
  if (day.closed || day.shifts.length === 0) return "Closed";
  return day.shifts.map((s) => `${formatTime(s.open)} – ${formatTime(s.close)}`).join(", ");
}

/** Earliest opening and latest closing hour across the week, for the calendar's time range. */
export function weekHourRange(hours: WorkingHours | null): { start: number; end: number } | null {
  if (!hours) return null;
  const shifts = WEEK_DAYS.flatMap(({ key }) => (hours[key].closed ? [] : hours[key].shifts));
  if (!shifts.length) return null;
  const start = Math.min(...shifts.map((s) => Number(s.open.slice(0, 2))));
  const end = Math.max(...shifts.map((s) => Math.ceil((Number(s.close.slice(0, 2)) * 60 + Number(s.close.slice(3))) / 60)));
  return { start, end };
}
