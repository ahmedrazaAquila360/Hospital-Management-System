import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getPrescriptionById } from "@/server/prescriptions/queries";
import { getClinicSettings } from "@/server/settings/queries";
import { PrintLayout } from "@/components/print/print-layout";
import { calculateAge, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Print Prescription" };

export default async function PrescriptionPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("prescriptions.view");
  const { id } = await params;
  const [rx, clinic] = await Promise.all([getPrescriptionById(id), getClinicSettings()]);
  if (!rx) notFound();

  return (
    <PrintLayout
      clinic={clinic}
      documentLabel="Prescription"
      downloadHref={`/api/prescriptions/${rx.id}/pdf`}
      downloadFileName={`prescription-${rx.patient.patientCode}.pdf`}
    >
      <div className="mb-8 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">Patient</p>
          <p className="font-medium">{rx.patient.fullName}</p>
          <p className="text-xs text-neutral-500">
            {rx.patient.patientCode} · {calculateAge(rx.patient.dob)} yrs · {rx.patient.phone}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-medium tracking-wide text-neutral-400 uppercase">Prescribed by</p>
          <p className="font-medium">{rx.dentist.name}</p>
          <p className="text-xs text-neutral-500">{formatDate(rx.date)}</p>
        </div>
      </div>

      <div className="mb-8">
        <p className="mb-3 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">℞ Medicines</p>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left text-xs text-neutral-500">
              <th className="py-2 pr-2 font-medium">Medicine</th>
              <th className="py-2 pr-2 font-medium">Dosage</th>
              <th className="py-2 pr-2 font-medium">Frequency</th>
              <th className="py-2 pr-2 font-medium">Duration</th>
              <th className="py-2 font-medium">Instructions</th>
            </tr>
          </thead>
          <tbody>
            {rx.medicines.map((m) => (
              <tr key={m.id} className="border-b border-neutral-100">
                <td className="py-2.5 pr-2 font-medium">{m.medicineName}</td>
                <td className="py-2.5 pr-2 text-neutral-600">{[m.dosage,m.route].filter(Boolean).join(" · ")}</td>
                <td className="py-2.5 pr-2 text-neutral-600">{m.frequency}</td>
                <td className="py-2.5 pr-2 text-neutral-600">{m.duration}</td>
                <td className="py-2.5 text-neutral-600">{m.instructions || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rx.instructions && (
        <div className="mb-10">
          <p className="mb-1 text-[10px] font-medium tracking-wide text-neutral-400 uppercase">General Instructions</p>
          <p className="text-sm text-neutral-700">{rx.instructions}</p>
        </div>
      )}

      <div className="mt-auto flex justify-end pt-16">
        <div className="w-56 text-center">
          <div className="mb-1 border-b border-neutral-400" />
          <p className="text-xs text-neutral-500">{rx.dentist.name} — Signature</p>
        </div>
      </div>
    </PrintLayout>
  );
}
