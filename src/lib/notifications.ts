import type { NotificationType } from "@/generated/prisma/enums";

/** Filter tabs on the Notifications page, each covering existing notification types. */
export const NOTIFICATION_CATEGORIES = [
  { value: "appointments", label: "Appointments", types: ["APPOINTMENT_NEW", "APPOINTMENT_CANCELLED", "APPOINTMENT_REMINDER"] },
  { value: "payments", label: "Payments", types: ["PAYMENT_RECEIVED", "PAYMENT_OUTSTANDING"] },
  { value: "patients", label: "Patients", types: ["PATIENT_NEW"] },
  { value: "treatments", label: "Treatments", types: ["TREATMENT_COMPLETED"] },
  { value: "system", label: "System", types: ["SYSTEM"] },
] as const satisfies readonly { value: string; label: string; types: readonly NotificationType[] }[];

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]["value"];

export function categoryOf(type: NotificationType): NotificationCategory {
  return NOTIFICATION_CATEGORIES.find((c) => (c.types as readonly string[]).includes(type))?.value ?? "system";
}
