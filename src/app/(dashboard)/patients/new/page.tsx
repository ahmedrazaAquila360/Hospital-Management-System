import type { Metadata } from "next";
import { UserPlus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { PatientForm } from "@/components/patients/patient-form";
import { createPatientAction } from "@/server/patients/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "Add Patient" };

type SearchParams = Promise<{ fullName?: string; phone?: string }>;

export default async function NewPatientPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("patients.create");
  const params = await searchParams;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/patients", label: "Back to Patients" }}
          icon={<UserPlus />}
          title="Add Patient"
          description="Register a new patient and their medical history."
        />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      {/* Prefilled from an online appointment request ("Register patient" link). */}
      <PatientForm
        action={createPatientAction}
        submitLabel="Add Patient"
        defaultFullName={params.fullName}
        defaultPhone={params.phone}
      />
    </div>
  );
}
