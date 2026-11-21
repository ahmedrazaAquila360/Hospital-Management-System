import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getClinicSettings } from "@/server/settings/queries";
import { PrintLayout } from "@/components/print/print-layout";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Discharge summary" };

export default async function DischargeSummary({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("ipd.view");
  const { id } = await params;
  const admission = await prisma.admission.findFirst({
    where: {
      id,
      status: "DISCHARGED",
      ...(user.role.name === "DENTIST" && { doctorId: user.id }),
    },
    include: {
      patient: { select: { fullName: true, patientCode: true, dob: true, allergies: true } },
      doctor: { select: { name: true } },
      department: { select: { name: true } },
      stays: { include: { bed: true }, orderBy: { start: "asc" } },
    },
  });
  if (!admission || !admission.dischargedAt) notFound();

  return (
    <PrintLayout clinic={await getClinicSettings()} documentLabel="Discharge summary">
      <div className="space-y-6 text-sm">
        <div>
          <h2 className="text-lg font-semibold">{admission.patient.fullName}</h2>
          <p>{admission.patient.patientCode} · Admission #{admission.number}</p>
          <p>Attending doctor · {admission.doctor.name}</p>
          <p>Department · {admission.department.name}</p>
        </div>
        <div>
          <p>Admitted · {formatDateTime(admission.admittedAt)}</p>
          <p>Discharged · {formatDateTime(admission.dischargedAt)}</p>
          <p>Recorded allergies · {admission.patient.allergies || "No information recorded"}</p>
        </div>
        <section>
          <h3 className="font-semibold">Admission diagnosis</h3>
          <p className="whitespace-pre-wrap">{admission.diagnosis}</p>
        </section>
        <section>
          <h3 className="font-semibold">Discharge summary and instructions</h3>
          <p className="whitespace-pre-wrap">{admission.summary}</p>
        </section>
        <section>
          <h3 className="font-semibold">Ward and bed history</h3>
          {admission.stays.map(stay => (
            <p key={stay.id}>
              {stay.bed.ward} / {stay.bed.room} / {stay.bed.label} · {formatDateTime(stay.start)}
              {stay.end && <> – {formatDateTime(stay.end)}</>}
            </p>
          ))}
        </section>
      </div>
    </PrintLayout>
  );
}
