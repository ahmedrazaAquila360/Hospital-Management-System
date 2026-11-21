import "server-only";
import { dbDateKey } from "@/lib/calendar";
import { formatDate, formatTime } from "@/lib/format";
import { APPOINTMENT_STATUS_LABEL, APPOINTMENT_TYPE_LABEL } from "@/lib/labels";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import type { listAppointmentsInRange } from "@/server/appointments/queries";

type Appointment = Awaited<ReturnType<typeof listAppointmentsInRange>>[number];

/** What the calendar draws for one appointment; nothing else reaches the views. */
export type CalendarEvent = {
  id: string;
  patientName: string;
  patientCode: string;
  patientPhone: string;
  /** e.g. "Mon, Nov 16" — shown in the hover card. */
  dateLabel: string;
  durationLabel: string;
  /** First 140 characters of the appointment notes, if any. */
  notes: string | null;
  dentistName: string;
  type: string;
  typeLabel: string;
  status: AppointmentStatus;
  statusLabel: string;
  /** Calendar day, YYYY-MM-DD. */
  dayKey: string;
  /** Minutes from midnight. */
  startMin: number;
  endMin: number;
  timeLabel: string;
};

/**
 * Times are read with the server's clock, which is also how the booking action builds them
 * (`new Date("YYYY-MM-DDTHH:mm")`), so a 9:00 booking is drawn at 9:00.
 */
export function toCalendarEvents(appointments: Appointment[]): CalendarEvent[] {
  return appointments.map((a) => {
    const startMin = a.startTime.getHours() * 60 + a.startTime.getMinutes();
    const rawEnd = a.endTime.getHours() * 60 + a.endTime.getMinutes();
    // An end at/after midnight or before the start would draw upside down; fall back to 30 min.
    const endMin = rawEnd > startMin ? rawEnd : Math.min(startMin + 30, 24 * 60);
    return {
      id: a.id,
      patientName: a.patient.fullName,
      patientCode: a.patient.patientCode,
      patientPhone: a.patient.phone,
      dateLabel: `${a.startTime.toLocaleDateString("en-US", { weekday: "short" })}, ${formatDate(a.startTime)}`,
      durationLabel: durationLabel(endMin - startMin),
      notes: a.notes ? (a.notes.length > 140 ? `${a.notes.slice(0, 140).trimEnd()}…` : a.notes) : null,
      dentistName: a.dentist.name,
      type: a.type,
      typeLabel: APPOINTMENT_TYPE_LABEL[a.type] ?? a.type,
      status: a.status,
      statusLabel: APPOINTMENT_STATUS_LABEL[a.status] ?? a.status,
      dayKey: dbDateKey(a.date),
      startMin,
      endMin,
      timeLabel: `${formatTime(a.startTime)} – ${formatTime(a.endTime)}`,
    };
  });
}

function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} hr ${m} min` : `${h} hr`) : `${m} min`;
}

/** Search across what is shown on the calendar (no search API exists for appointments). */
export function matchesQuery(a: Appointment, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [a.patient.fullName, a.patient.patientCode, a.dentist.name, APPOINTMENT_TYPE_LABEL[a.type] ?? a.type]
    .some((v) => v?.toLowerCase().includes(q));
}
