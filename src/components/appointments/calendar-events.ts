import "server-only";
import { dbDateKey } from "@/lib/calendar";
import { appointmentClock, appointmentMinutes } from "@/lib/appointment-clock";
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
 * Draw stored instants using the configured hospital timezone.
 */
export function toCalendarEvents(appointments: Appointment[], timeZone: string): CalendarEvent[] {
  return appointments.map((a) => {
    const startMin = appointmentMinutes(a.startTime, timeZone);
    const rawEnd = appointmentMinutes(a.endTime, timeZone);
    // An end at/after midnight or before the start would draw upside down; fall back to 30 min.
    const endMin = rawEnd > startMin ? rawEnd : Math.min(startMin + 30, 24 * 60);
    return {
      id: a.id,
      patientName: a.patient.fullName,
      patientCode: a.patient.patientCode,
      patientPhone: a.patient.phone,
      dateLabel: a.startTime.toLocaleDateString("en-US", { timeZone, weekday: "short", year: "numeric", month: "short", day: "numeric" }),
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
      timeLabel: `${appointmentClock(a.startTime,timeZone)} – ${appointmentClock(a.endTime,timeZone)}`,
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
