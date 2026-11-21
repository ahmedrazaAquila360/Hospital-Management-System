import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UserPen } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getPatientById } from "@/server/patients/queries";
import { PatientForm } from "@/components/patients/patient-form";
import { updatePatientAction } from "@/server/patients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Edit Patient" };

export default async function EditPatientPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("patients.edit");
  const { id } = await params;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const boundAction = updatePatientAction.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: `/patients/${id}`, label: "Back to Patient Profile" }}
          icon={<UserPen />}
          title="Edit Patient"
          description={<>Update {patient.fullName}&apos;s information.</>}
        />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <PatientForm action={boundAction} patient={patient} medicalHistory={patient.medicalHistory} submitLabel="Save Changes" />
    </div>
  );
}
