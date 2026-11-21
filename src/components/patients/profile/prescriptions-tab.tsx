import Link from "next/link";
import { Download, Pill, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatDate } from "@/lib/format";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function PrescriptionsTab({ patient }: { patient: Patient }) {
  if (patient.prescriptions.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyMedia variant="icon">
              <Pill />
            </EmptyMedia>
            <EmptyTitle>No prescriptions yet</EmptyTitle>
            <EmptyDescription>Prescriptions written for this patient will appear here.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {patient.prescriptions.map((rx) => (
        <Card key={rx.id}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-medium">
              {formatDate(rx.date)} · Dr. {rx.dentist.name.replace(/^Dr\.\s*/, "")}
            </CardTitle>
            <div className="flex gap-1">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/prescriptions/${rx.id}/print`} target="_blank">
                  <Printer /> Print
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <a href={`/api/prescriptions/${rx.id}/pdf`} download={`prescription-${patient.patientCode}.pdf`}>
                  <Download /> Download
                </a>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {rx.medicines.map((m) => (
                <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span className="font-medium">{m.medicineName}</span>
                  <span className="text-muted-foreground">
                    {m.dosage} · {m.frequency} · {m.duration}
                  </span>
                </li>
              ))}
            </ul>
            {rx.instructions && <p className="text-muted-foreground mt-2 text-sm">{rx.instructions}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
