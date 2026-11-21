import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getChartTreatments, getDentalChartForPatient } from "@/server/dental-chart/queries";
import { DentalChartViews } from "@/components/dental-chart/dental-chart-views";
import { PatientWorkspace, type PatientWorkspaceParams } from "@/components/dental-chart/patient-workspace";
import { can } from "@/lib/permissions";

export const metadata: Metadata = { title: "Dental Chart" };

type SearchParams = Promise<{ patientId?: string; view?: string; tab?: string } & PatientWorkspaceParams>;

const SECTIONS = ["chart", "procedures", "notes", "history"] as const;

export default async function DentalChartPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("dental_chart.view");
  const { patientId, view, tab, ...pickerParams } = await searchParams;

  if (!patientId) {
    return <PatientWorkspace user={user} params={pickerParams} />;
  }

  const [patient, treatments] = await Promise.all([getDentalChartForPatient(patientId), getChartTreatments(patientId)]);
  if (!patient) notFound();
  const section = SECTIONS.find((s) => s === tab) ?? "chart";

  return (
    <div className="flex flex-col gap-4">
      {/* Keyed by patient so switching patients never carries a selection or preview across. */}
      <DentalChartViews
        key={patient.id}
        patient={patient}
        treatments={treatments}
        canManage={can(user, "dental_chart.edit")}
        canManageTreatments={can(user, "treatments.create")}
        canEditPatient={can(user, "patients.edit")}
        initialView={view === "3d" ? "3d" : "2d"}
        initialSection={section}
      />
    </div>
  );
}
