import type { AppointmentStatus } from "@/generated/prisma/enums";

/**
 * The visit flow, shared by the status menu (what to offer) and the server action (what to
 * accept): Scheduled → (Confirmed) → Checked In → In Progress → Completed. Cancel is open until
 * the visit ends; No-show only before the patient has arrived.
 */
export const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  SCHEDULED: ["CONFIRMED", "CHECKED_IN"],
  CONFIRMED: ["CHECKED_IN"],
  CHECKED_IN: ["IN_PROGRESS"],
  IN_PROGRESS: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const FINAL_STATUSES: AppointmentStatus[] = ["COMPLETED", "CANCELLED", "NO_SHOW"];

export const canCancel = (status: AppointmentStatus) => !FINAL_STATUSES.includes(status);
export const canMarkNoShow = (status: AppointmentStatus) => status === "SCHEDULED" || status === "CONFIRMED";
/** A no-show can be booked again for another time; a finished or cancelled visit can't move. */
export const canReschedule = (status: AppointmentStatus) => ["SCHEDULED", "CONFIRMED", "NO_SHOW"].includes(status);

export function canChangeStatus(from: AppointmentStatus, to: AppointmentStatus) {
  if (to === "CANCELLED") return canCancel(from);
  if (to === "NO_SHOW") return canMarkNoShow(from);
  return NEXT_STATUSES[from].includes(to);
}

/** The status-change verb each activity-log entry is written with ("… confirmed the appointment …"). */
export const STATUS_VERBS: Record<AppointmentStatus, string> = {
  SCHEDULED: "scheduled",
  CONFIRMED: "confirmed",
  CHECKED_IN: "checked in",
  IN_PROGRESS: "started",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "marked as no-show",
};
