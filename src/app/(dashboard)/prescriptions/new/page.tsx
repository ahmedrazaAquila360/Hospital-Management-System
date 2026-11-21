import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { getDentists } from "@/server/appointments/queries";
import { PrescriptionForm } from "@/components/prescriptions/prescription-form";
import { createPrescriptionAction } from "@/server/prescriptions/actions";
import { ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "New Prescription" };

type SearchParams = Promise<{ patientId?: string; appointmentId?: string; encounterId?: string }>;

export default async function NewPrescriptionPage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("prescriptions.create");
  const params = await searchParams;

  const [dentists, defaultPatient, medicines] = await Promise.all([
    getDentists(),
    params.patientId ? prisma.patient.findUnique({ where: { id: params.patientId, AND: [patientScope(actor)] } }) : null,
    prisma.medication.findMany({ select: { generic: true, brand: true } }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/prescriptions", label: "Back to Prescriptions" }} icon={<ClipboardList />} title="New Prescription" description="Write a prescription for a patient." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <PrescriptionForm
        medicineOptions={[...new Set(medicines.flatMap(m => [m.generic,m.brand]))]}
        action={createPrescriptionAction}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        defaultPatient={defaultPatient}
        defaultEncounterId={params.encounterId}
        defaultAppointmentId={params.appointmentId}
      />
    </div>
  );
}
