import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, Printer } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { getPrescriptionById } from "@/server/prescriptions/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { BackLink } from "@/components/shared/back-link";

export const metadata: Metadata = { title: "Prescription" };

export default async function PrescriptionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("prescriptions.view");
  const { id } = await params;
  const rx = await getPrescriptionById(id);
  if (!rx) notFound();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <BackLink href="/prescriptions" label="Back to Prescriptions" />
      <Card>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href={`/patients/${rx.patientId}`} className="text-muted-foreground text-sm hover:underline">
              {rx.patient.fullName}
            </Link>
            <h2 className="text-lg font-semibold tracking-tight">Prescription · {formatDate(rx.date)}</h2>
            <p className="text-muted-foreground text-sm">{rx.dentist.name}</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/prescriptions/${rx.id}/print`} target="_blank">
                <Printer /> Print
              </Link>
            </Button>
            <Button asChild>
              <a href={`/api/prescriptions/${rx.id}/pdf`} download={`prescription-${rx.patient.patientCode}.pdf`}>
                <Download /> Download PDF
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medicines</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {rx.medicines.map((m) => (
            <div key={m.id} className="py-2.5 text-sm">
              <p className="font-medium">{m.medicineName}</p>
              <p className="text-muted-foreground text-xs">
                {[m.dosage,m.route].filter(Boolean).join(" · ")} · {m.frequency} · {m.duration}
                {m.instructions ? ` · ${m.instructions}` : ""}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {rx.instructions && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">General Instructions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{rx.instructions}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
