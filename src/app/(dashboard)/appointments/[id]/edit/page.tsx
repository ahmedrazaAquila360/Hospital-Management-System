import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getAppointmentById, getDentists } from "@/server/appointments/queries";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { getWorkingHours } from "@/server/settings/queries";
import { updateAppointmentAction } from "@/server/appointments/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Edit Appointment" };

/** HH:mm on the server's clock: the same clock the booking action used to save the time. */
function clockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default async function EditAppointmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("appointments.edit");
  const { id } = await params;
  const [appointment, dentists, workingHours] = await Promise.all([getAppointmentById(id), getDentists(), getWorkingHours()]);
  if (!appointment) notFound();

  const boundAction = updateAppointmentAction.bind(null, id);
  // The form needs the appointment's own fields only. The included treatments carry Decimal
  // money values React can't send to the browser, and the dentist/booker rows don't belong there.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { treatments, prescriptions, patient, dentist, createdBy, ...visit } = appointment;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: `/appointments/${id}`, label: "Back to Appointment" }}
          icon={<CalendarClock />}
          title="Edit Appointment"
          description={<>Update the visit for {appointment.patient.fullName}.</>}
        />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <AppointmentForm
        workingHours={workingHours}
        action={boundAction}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        appointment={visit}
        defaultPatient={patient}
        defaultStartTime={clockTime(appointment.startTime)}
        defaultEndTime={clockTime(appointment.endTime)}
        submitLabel="Save Changes"
      />
    </div>
  );
}
