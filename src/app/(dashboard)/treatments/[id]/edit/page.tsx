import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getTreatmentById } from "@/server/treatments/queries";
import { getDentists } from "@/server/appointments/queries";
import { TreatmentForm } from "@/components/treatments/treatment-form";
import { updateTreatmentAction } from "@/server/treatments/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";

export const metadata: Metadata = { title: "Edit Treatment" };

export default async function EditTreatmentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("treatments.edit");
  const { id } = await params;
  const [treatment, dentists] = await Promise.all([getTreatmentById(id), getDentists()]);
  if (!treatment) notFound();

  const boundAction = updateTreatmentAction.bind(null, id);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: `/treatments/${id}`, label: "Back to Treatment" }} icon={<ToothIcon />} title="Edit Treatment" description={<>Update the treatment plan for {treatment.patient.fullName}.</>} />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <TreatmentForm
        action={boundAction}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        treatment={treatment}
        defaultPatient={treatment.patient}
        defaultTeeth={treatment.teeth.map((t) => t.tooth.toothNumber)}
        submitLabel="Save Changes"
        cancelHref={`/treatments/${id}`}
      />
    </div>
  );
}
