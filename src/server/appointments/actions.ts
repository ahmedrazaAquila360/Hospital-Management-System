"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, assertPermission } from "@/lib/auth/guard";
import type { AppointmentStatus } from "@/generated/prisma/enums";
import { createAppointment, updateAppointment, updateAppointmentStatus, rescheduleAppointment } from "./service";
import type { AppointmentFormState, AppointmentStatusResult, RescheduleResult } from "./service";
export type { AppointmentFormState, AppointmentStatusResult, RescheduleResult } from "./service";

function refresh() {
  revalidatePath("/appointments", "layout"); revalidatePath("/opd");
  revalidatePath("/patients", "layout"); revalidatePath("/dashboard");
}
function conflict(error: unknown) {
  const message = String(error);
  return /P2025|P2002|23P01|exclusion constraint|conflicting key|No record was found/.test(message);
}
export async function createAppointmentAction(prev: AppointmentFormState, form: FormData): Promise<AppointmentFormState> {
  const user = await requireUser();
  let result: AppointmentFormState;
  try { result = await createAppointment(user, prev, form); }
  catch (error) { if (conflict(error)) return { error: "This slot was taken. Refresh and choose another time." }; throw error; }
  if (!result.appointmentId) return result;
  refresh(); redirect(`/appointments/${result.appointmentId}`);
}
export async function updateAppointmentAction(id: string, prev: AppointmentFormState, form: FormData): Promise<AppointmentFormState> {
  const user = await requireUser();
  let result: AppointmentFormState;
  try { result = await updateAppointment(user, id, prev, form); }
  catch (error) { if (conflict(error)) return { error: "The appointment or slot changed. Refresh before editing." }; throw error; }
  if (!result.appointmentId) return result;
  refresh(); redirect(`/appointments/${id}`);
}
export async function updateAppointmentStatusAction(id: string, status: AppointmentStatus): Promise<AppointmentStatusResult> {
  const user = await requireUser();
  try { const result = await updateAppointmentStatus(user,id,status); refresh(); return result; }
  catch (error) { if (conflict(error)) return { ok: false, error: "The appointment changed. Refresh to see its status." }; throw error; }
}
export async function rescheduleAppointmentAction(id: string, input: { date: string; startTime: string; endTime: string }): Promise<RescheduleResult> {
  const user = await requireUser();
  try { const result = await rescheduleAppointment(user,id,input); refresh(); return result; }
  catch (error) { if (conflict(error)) return { ok: false, error: "The appointment or slot changed. Refresh and try again." }; throw error; }
}
export async function deleteAppointmentAction(_id: string) {
  void _id;
  const user = await requireUser(); assertPermission(user,"appointments.delete");
  throw new Error("Appointment history is retained. Cancel an upcoming appointment instead.");
}
