import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { getDentists } from "@/server/appointments/queries";
import { TreatmentForm } from "@/components/treatments/treatment-form";
import { createTreatmentAction } from "@/server/treatments/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";

export const metadata: Metadata = { title: "New Treatment" };

type SearchParams = Promise<{ patientId?: string; appointmentId?: string; toothNumber?: string }>;

export default async function NewTreatmentPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("treatments.create");
  const currency=(await getClinicSettings()).currency;
  const params = await searchParams;

  const [dentists, defaultPatient] = await Promise.all([
    getDentists(),
    params.patientId ? prisma.patient.findUnique({ where: { id: params.patientId, archivedAt: null, AND: [patientScope(actor)] } }) : null,
  ]);
  const tooth = Number(params.toothNumber);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={defaultPatient ? { href: `/patients/${defaultPatient.id}`, label: `Back to ${defaultPatient.fullName}` } : { href: "/treatments", label: "Back to Treatments" }} icon={<ToothIcon />} title="New Treatment" description="Create a treatment plan for a patient." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <TreatmentForm
        currency={currency}
        action={createTreatmentAction}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        defaultPatient={defaultPatient}
        defaultTeeth={Number.isInteger(tooth) ? [tooth] : []}
        defaultAppointmentId={params.appointmentId}
        cancelHref={defaultPatient ? `/patients/${defaultPatient.id}` : "/treatments"}
      />
    </div>
  );
}
