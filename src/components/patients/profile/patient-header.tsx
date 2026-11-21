import Link from "next/link";
import { CalendarPlus, Pencil, ReceiptText, Trash2, TriangleAlert } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeletePatientDialog } from "@/components/patients/delete-patient-dialog";
import { calculateAge, formatDate, initialsFromName, titleCase } from "@/lib/format";
import { can, type SessionUser } from "@/lib/permissions";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function PatientHeader({ patient, user }: { patient: Patient; user: SessionUser }) {
  return (
    <div className="surface-card relative flex flex-col gap-4 overflow-hidden p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div aria-hidden className="absolute inset-x-0 top-0 h-20 bg-linear-to-r from-[#e3f3fc] via-[#f1f8fd] to-transparent" />
      <div className="relative flex items-center gap-4">
        <Avatar className="size-16 ring-4 ring-white shadow-md sm:size-[72px]">
          {patient.photoUrl && <AvatarImage src={patient.photoUrl} alt={patient.fullName} />}
          <AvatarFallback className="bg-linear-to-br from-[#4fd0f3] to-[#0b5fae] text-lg font-semibold text-white">
            {initialsFromName(patient.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-navy text-xl font-semibold tracking-tight">{patient.fullName}</h2>
            <Badge variant="outline" className="font-mono text-[11px] font-medium">
              {patient.patientCode}
            </Badge>
            {patient.allergies && (
              <Badge variant="outline" className="text-destructive border-transparent bg-[#fdedef] font-medium ring-1 ring-[#f5ccd2] ring-inset">
                <TriangleAlert className="size-3" /> {patient.allergies}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {calculateAge(patient.dob)} yrs · {titleCase(patient.gender)} · {patient.phone}
            {patient.email ? ` · ${patient.email}` : ""}
          </p>
          <p className="text-muted-foreground text-xs">
            Patient since {formatDate(patient.createdAt)}
            {patient.createdBy ? ` · registered by ${patient.createdBy.name}` : ""}
          </p>
        </div>
      </div>

      <div className="relative flex flex-wrap gap-2">
        {can(user, "appointments.create") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/appointments/new?patientId=${patient.id}`}>
              <CalendarPlus /> Book Appointment
            </Link>
          </Button>
        )}
        {can(user, "billing.create") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/billing/invoices/new?patientId=${patient.id}`}>
              <ReceiptText /> New Invoice
            </Link>
          </Button>
        )}
        {can(user, "patients.edit") && (
          <Button asChild size="sm">
            <Link href={`/patients/${patient.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>
        )}
        {can(user, "patients.delete") && (
          <DeletePatientDialog
            patientId={patient.id}
            patientCode={patient.patientCode}
            patientName={patient.fullName}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 /> Archive
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
