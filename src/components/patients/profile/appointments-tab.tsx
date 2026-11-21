import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { formatDate, formatTime, titleCase } from "@/lib/format";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status";
import type { getPatientById } from "@/server/patients/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

export function AppointmentsTab({ patient }: { patient: Patient }) {
  if (patient.appointments.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyMedia variant="icon">
              <CalendarClock />
            </EmptyMedia>
            <EmptyTitle>No appointments yet</EmptyTitle>
            <EmptyDescription>Appointments booked for this patient will appear here.</EmptyDescription>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="divide-y p-0">
        {patient.appointments.map((a) => (
          <Link
            key={a.id}
            href={`/appointments/${a.id}`}
            className="hover:bg-accent/50 flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-medium">
                {titleCase(a.type)} with {a.dentist.name}
              </p>
              <p className="text-muted-foreground text-xs">
                {formatDate(a.date)} · {formatTime(a.startTime)}–{formatTime(a.endTime)}
              </p>
              {a.notes && <p className="text-muted-foreground text-xs">{a.notes}</p>}
            </div>
            <StatusBadge status={a.status} tone={APPOINTMENT_STATUS_TONE[a.status]} />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
