"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { assertPermission, requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { invoiceService } from "@/server/billing/service-charge";
import { appointmentSchema } from "@/lib/validations/appointment";
import { getWorkingHours } from "@/server/settings/queries";
import { parseWorkingHours, workingHoursProblem } from "@/lib/working-hours";
import { formatDate, formatTime } from "@/lib/format";
import { canChangeStatus, canReschedule, STATUS_VERBS } from "@/lib/appointment-status";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export type AppointmentFormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function parseForm(formData: FormData) {
  return appointmentSchema.safeParse({
    patientId: formData.get("patientId"),
    dentistId: formData.get("dentistId"),
    date: formData.get("date"),
    startTime: formData.get("startTime"),
    endTime: formData.get("endTime"),
    type: formData.get("type"),
    notes: formData.get("notes") ?? "",
  });
}

function combineDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

/** Appointments must fit inside one of the clinic's shifts on an open day (Settings → Working Hours). */
async function hoursError(date: string, start: string, end: string, doctorId: string, excludeId?: string): Promise<AppointmentFormState | null> {
  const [hospitalHours, doctor, overlap] = await Promise.all([
    getWorkingHours(),
    prisma.user.findFirst({ where: { id: doctorId, status: "ACTIVE", role: { name: "DENTIST" } }, select: { doctorProfile: true } }),
    prisma.appointment.findFirst({ where: { dentistId: doctorId, id: { not: excludeId }, status: { in: ["SCHEDULED", "CHECKED_IN", "CONFIRMED", "IN_PROGRESS"] },
      startTime: { lt: combineDateTime(date,end) }, endTime: { gt: combineDateTime(date,start) } }, select: { id: true } }),
  ]);
  if (!doctor) return { error: "Choose an active doctor." };
  const problem = workingHoursProblem(hospitalHours,date,start,end) || workingHoursProblem(parseWorkingHours(doctor.doctorProfile?.hours),date,start,end)
    || (overlap ? "This doctor already has an appointment during that time." : null);
  return problem ? { error: problem, fieldErrors: { startTime: problem } } : null;
}

function hhmm(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const field = issue.path[0];
    if (typeof field === "string") fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

export async function createAppointmentAction(_prev: AppointmentFormState, formData: FormData): Promise<AppointmentFormState> {
  const user = await requireUser();
  if (!can(user, "appointments.create")) return { error: "You don't have permission to do that." };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), error: "Please fix the highlighted fields." };
  }
  const data = parsed.data;
  if (user.role.name === "DENTIST" && (data.dentistId !== user.id || !await prisma.patient.findFirst({ where: { id: data.patientId, AND: [patientScope(user)] }, select: { id: true } }))) return { error: "Choose an assigned patient and your own doctor account." };
  const outside = await hoursError(data.date, data.startTime, data.endTime, data.dentistId);
  if (outside) return outside;

  const [patient, dentist] = await Promise.all([
    prisma.patient.findUnique({ where: { id: data.patientId } }),
    prisma.user.findUnique({ where: { id: data.dentistId } }),
  ]);
  if (!patient || !dentist) return { error: "Invalid patient or dentist." };

  const walkIn = formData.get("walkIn") === "on";
  if (walkIn && !can(user,"appointments.edit")) return { error: "Check-in permission is required." };
  const appointment = await prisma.$transaction(async tx => {
    const appointment = await tx.appointment.create({
      data: {
        patientId: data.patientId,
        dentistId: data.dentistId,
        departmentId: dentist.departmentId,
        walkIn, emergency: formData.get("emergency") === "on",
        ...(walkIn && { status: "CHECKED_IN", encounter: { create: {} } }),
        date: new Date(data.date),
        startTime: combineDateTime(data.date, data.startTime),
        endTime: combineDateTime(data.date, data.endTime),
        type: data.type,
        notes: data.notes || null,
        createdById: user.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: dentist.id,
        type: "APPOINTMENT_NEW",
        title: "New appointment scheduled",
        message: `${patient.fullName} on ${data.date} at ${data.startTime}.`,
        link: `/appointments/${appointment.id}`,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "CREATE",
        entityType: "Appointment",
        entityId: appointment.id,
        description: `${user.name} booked an appointment for ${patient.fullName} with ${dentist.name}.`,
      },
    });
    return appointment;
  });
  revalidatePath("/opd");
  revalidatePath("/appointments");
  revalidatePath(`/patients/${patient.id}`);
  redirect(`/appointments/${appointment.id}`);
}

export async function updateAppointmentAction(
  id: string,
  _prev: AppointmentFormState,
  formData: FormData
): Promise<AppointmentFormState> {
  const user = await requireUser();
  if (!can(user, "appointments.edit")) return { error: "You don't have permission to do that." };
  const parsed = parseForm(formData);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), error: "Please fix the highlighted fields." };
  }
  const data = parsed.data;
  if (user.role.name === "DENTIST" && (data.dentistId !== user.id || !await prisma.patient.findFirst({ where: { id: data.patientId, AND: [patientScope(user)] }, select: { id: true } }))) return { error: "Choose an assigned patient and your own doctor account." };

  // Only a changed date or time is checked, so editing the notes of an appointment booked
  // before the hours changed still works.
  const existing = await prisma.appointment.findUnique({ where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) }, select: { startTime: true, endTime: true, encounter: { select: { id: true } }, patientId: true, dentistId: true, departmentId: true } });
  if (existing?.encounter && (existing.patientId !== data.patientId || existing.dentistId !== data.dentistId)) return { error: "The patient and doctor are fixed after check-in." };
  const sameSlot =
    existing &&
    combineDateTime(data.date, data.startTime).getTime() === existing.startTime.getTime() &&
    data.endTime === hhmm(existing.endTime);
  if (!sameSlot || existing?.dentistId !== data.dentistId) {
    const outside = await hoursError(data.date, data.startTime, data.endTime, data.dentistId, id);
    if (outside) return outside;
  }

  const assignedDoctor = await prisma.user.findUniqueOrThrow({ where: { id: data.dentistId }, select: { departmentId: true } });
  const appointment = await prisma.appointment.update({
    where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) },
    data: {
      departmentId: existing?.dentistId === data.dentistId ? existing.departmentId : assignedDoctor.departmentId,
      patientId: data.patientId,
      dentistId: data.dentistId,
      date: new Date(data.date),
      startTime: combineDateTime(data.date, data.startTime),
      endTime: combineDateTime(data.date, data.endTime),
      type: data.type,
      notes: data.notes || null,
    },
    include: { patient: true },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "Appointment",
      entityId: id,
      description: sameSlot
        ? `${user.name} updated the appointment for ${appointment.patient.fullName}.`
        : `${user.name} rescheduled the appointment for ${appointment.patient.fullName}.`,
      metadata: { kind: sameSlot ? "edit" : "reschedule" },
    },
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath(`/patients/${appointment.patientId}`);
  redirect(`/appointments/${id}`);
}

export type AppointmentStatusResult = { ok: true } | { ok: false; error: string };

export async function updateAppointmentStatusAction(id: string, status: AppointmentStatus): Promise<AppointmentStatusResult> {
  const user = await requireUser();
  assertPermission(user, "appointments.edit");
  // Only moves the visit flow allows (the menu offers the same ones); a stale page can't
  // reopen a completed visit or skip back.
  const current = await prisma.appointment.findUnique({ where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) }, select: { status: true } });
  if (!current) return { ok: false, error: "This appointment no longer exists." };
  if (current.status === status) return { ok: true };
  if (!canChangeStatus(current.status, status)) {
    return { ok: false, error: "That status change isn't allowed for this appointment any more. Refresh to see its current status." };
  }
  const appointment = await prisma.$transaction(async tx => {
    const appointment = await tx.appointment.update({
      where: { id, status: current.status, ...(user.role.name === "DENTIST" && { dentistId: user.id }) },
      data: { status },
      include: { patient: true, dentist: true },
    });

    await tx.activityLog.create({
      data: {
        userId: user.id,
        action: "STATUS_CHANGE",
        entityType: "Appointment",
        entityId: id,
        description: `${user.name} ${STATUS_VERBS[status]} the appointment for ${appointment.patient.fullName}.`,
        metadata: { from: current.status, to: status },
      },
    });

    if (status === "CANCELLED") {
      await tx.notification.create({
        data: {
          userId: appointment.dentistId,
          type: "APPOINTMENT_CANCELLED",
          title: "Appointment cancelled",
          message: `${appointment.patient.fullName}'s appointment was cancelled.`,
          link: `/appointments/${id}`,
        },
      });
    }
    if (status === "COMPLETED") {
      const profile = await tx.doctorProfile.findUnique({ where: { userId: appointment.dentistId } });
      if (profile) await invoiceService(tx, "OPD-" + id, appointment.patientId, appointment.dentistId, user.id, "Outpatient consultation", profile.consultationFee);
    }
    if (status === "CHECKED_IN") await tx.encounter.create({ data: { appointmentId: id } });
    return appointment;
  });
  revalidatePath("/opd");
  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath(`/patients/${appointment.patientId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export type RescheduleResult = { ok: true } | { ok: false; error: string; field?: "date" | "startTime" | "endTime" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Moves an appointment to a new date and time and nothing else (the Edit page changes the rest).
 * Same rules as booking: a valid slot inside the clinic's hours. A no-show booked again goes
 * back to Scheduled; completed and cancelled visits stay where they were.
 */
export async function rescheduleAppointmentAction(
  id: string,
  input: { date: string; startTime: string; endTime: string }
): Promise<RescheduleResult> {
  const user = await requireUser();
  if (!can(user, "appointments.edit")) return { ok: false, error: "You don't have permission to reschedule appointments." };
  const { date, startTime, endTime } = input;
  if (!DATE_RE.test(date) || Number.isNaN(new Date(date).getTime())) return { ok: false, error: "Select a valid date.", field: "date" };
  if (!TIME_RE.test(startTime)) return { ok: false, error: "Select a valid start time.", field: "startTime" };
  if (!TIME_RE.test(endTime)) return { ok: false, error: "Select a valid end time.", field: "endTime" };
  if (endTime <= startTime) return { ok: false, error: "End time must be after start time.", field: "endTime" };

  const existing = await prisma.appointment.findUnique({
    where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) },
    select: { status: true, dentistId: true, startTime: true, endTime: true, patient: { select: { id: true, fullName: true } } },
  });
  if (!existing) return { ok: false, error: "This appointment no longer exists." };
  if (!canReschedule(existing.status)) {
    return { ok: false, error: `A ${existing.status === "COMPLETED" ? "completed" : "cancelled"} appointment can't be rescheduled.` };
  }

  const start = combineDateTime(date, startTime);
  const end = combineDateTime(date, endTime);
  if (start.getTime() === existing.startTime.getTime() && end.getTime() === existing.endTime.getTime()) {
    return { ok: false, error: "Choose a different date or time to reschedule.", field: "date" };
  }
  const outside = await hoursError(date, startTime, endTime, existing.dentistId, id);
  if (outside) return { ok: false, error: outside.error ?? "Outside working hours.", field: "startTime" };

  const reopened = existing.status === "NO_SHOW";
  await prisma.appointment.update({
    where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) },
    data: { date: new Date(date), startTime: start, endTime: end, ...(reopened ? { status: "SCHEDULED" as const } : {}) },
  });

  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "UPDATE",
      entityType: "Appointment",
      entityId: id,
      description: `${user.name} rescheduled the appointment for ${existing.patient.fullName} to ${formatDate(start)} at ${formatTime(start)}.`,
      metadata: {
        kind: "reschedule",
        from: { start: existing.startTime.toISOString(), end: existing.endTime.toISOString() },
        to: { start: start.toISOString(), end: end.toISOString() },
        ...(reopened ? { status: { from: "NO_SHOW", to: "SCHEDULED" } } : {}),
      },
    },
  });

  revalidatePath("/appointments");
  revalidatePath(`/appointments/${id}`);
  revalidatePath(`/patients/${existing.patient.id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function deleteAppointmentAction(id: string) {
  const user = await requireUser();
  assertPermission(user, "appointments.delete");
  const appointment = await prisma.appointment.delete({ where: { id, ...(user.role.name === "DENTIST" && { dentistId: user.id }) } });
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: "DELETE",
      entityType: "Appointment",
      entityId: id,
      description: `${user.name} deleted an appointment.`,
    },
  });
  revalidatePath("/appointments");
  revalidatePath(`/patients/${appointment.patientId}`);
  redirect("/appointments");
}
