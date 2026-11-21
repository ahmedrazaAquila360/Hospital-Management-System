"use server";

import { prisma } from "@/lib/prisma";
import { appointmentRequestSchema } from "@/lib/validations/appointment-request";
import { getWorkingHours } from "@/server/settings/queries";
import { dayFor } from "@/lib/working-hours";

export type BookingFormState = { success?: boolean; error?: string };

export async function createAppointmentRequestAction(
  _prev: BookingFormState,
  formData: FormData
): Promise<BookingFormState> {
  const parsed = appointmentRequestSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    email: formData.get("email") ?? "",
    preferredDentistId: formData.get("preferredDentistId") || undefined,
    preferredDate: formData.get("preferredDate"),
    preferredTime: formData.get("preferredTime"),
    reason: formData.get("reason") ?? "",
    company: formData.get("company") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }
  const data = parsed.data;

  // Silently "succeed" for bots that filled the honeypot, without writing anything.
  if (data.company) {
    return { success: true };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const preferredDate = new Date(`${data.preferredDate}T00:00:00Z`);
  if (preferredDate < today) {
    return { error: "Please choose a date from today onward." };
  }
  const hours = await getWorkingHours();
  if (hours) {
    const day = dayFor(hours, data.preferredDate);
    if (day.hours.closed) return { error: `The clinic is closed on ${day.label}s. Please choose another day.` };
  }

  const request = await prisma.appointmentRequest.create({
    data: {
      fullName: data.fullName,
      phone: data.phone,
      email: data.email || null,
      preferredDentistId: data.preferredDentistId || null,
      preferredDate,
      preferredTime: data.preferredTime,
      reason: data.reason || null,
    },
  });

  const staff = await prisma.user.findMany({
    where: { role: { name: { in: ["SUPER_ADMIN", "ADMIN", "RECEPTIONIST"] } }, status: "ACTIVE" },
    select: { id: true },
  });
  if (staff.length) {
    await prisma.notification.createMany({
      data: staff.map((s) => ({
        userId: s.id,
        type: "APPOINTMENT_NEW" as const,
        title: "New appointment request",
        message: `${request.fullName} requested a visit via the website.`,
        link: "/appointments/requests",
      })),
    });
  }

  return { success: true };
}
