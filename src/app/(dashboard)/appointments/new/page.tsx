import type { Metadata } from "next";
import { CalendarPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { getDentists } from "@/server/appointments/queries";
import { AppointmentForm } from "@/components/appointments/appointment-form";
import { getWorkingHours } from "@/server/settings/queries";
import { createAppointmentAction } from "@/server/appointments/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "New Appointment" };

type SearchParams = Promise<{ patientId?: string; date?: string; followUp?: string }>;

export default async function NewAppointmentPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("appointments.create");
  const params = await searchParams;

  const [dentists, defaultPatient, workingHours] = await Promise.all([
    getDentists(),
    params.patientId ? prisma.patient.findUnique({ where: { id: params.patientId, archivedAt: null, AND: [patientScope(actor)] } }) : null,
    getWorkingHours(),
  ]);
  // Only pass through a well-formed ?date= (the calendar's "Add" links set it).
  const defaultDate = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "") ? params.date : undefined;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/appointments", label: "Back to Appointments" }} icon={<CalendarPlus />} title="Book Appointment" description="Schedule a new patient visit." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <AppointmentForm
        followUp={params.followUp === "1"}
        workingHours={workingHours}
        action={createAppointmentAction}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        defaultPatient={defaultPatient}
        defaultDate={defaultDate}
      />
    </div>
  );
}
