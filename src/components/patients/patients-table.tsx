import Link from "next/link";
import { UserRoundSearch } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PatientRowActions } from "@/components/patients/patient-row-actions";
import { calculateAge, formatCurrency, formatDate, initialsFromName, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Gender } from "@/generated/prisma/enums";

export type PatientRow = {
  id: string;
  patientCode: string;
  fullName: string;
  photoUrl: string | null;
  phone: string;
  dob: Date;
  gender: Gender;
  lastVisit: Date | null;
  dentist: string | null;
  treatmentStatus: string;
  outstandingBalance: number;
};

const TREATMENT_STATUS: Record<string, { label: string; className: string }> = {
  PLANNED: { label: "Planned", className: "bg-blue-50 text-blue-800" },
  IN_PROGRESS: { label: "In Progress", className: "bg-amber-50 text-amber-800" },
  COMPLETED: { label: "Completed", className: "bg-emerald-50 text-emerald-800" },
  NONE: { label: "No Treatment", className: "bg-slate-100 text-slate-600" },
};

/** Patient list: a table on wide containers, cards on narrow ones. */
export function PatientsTable({currency,
  rows,
  canManage,
  canDelete = false,
  filtered,
}: { currency:string;
  rows: PatientRow[];
  canManage: boolean;
  canDelete?: boolean;
  filtered: boolean;
}) {
  const money=(value:unknown)=>formatCurrency(value,currency);
  if (rows.length === 0) {
    return (
      <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
        <EmptyMedia variant="icon">
          <UserRoundSearch />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "No matching patients" : "No patients yet"}</EmptyTitle>
        <EmptyDescription>{filtered ? "Try a different name, ID or phone, or reset the filters." : "Add your first patient to get started."}</EmptyDescription>
      </Empty>
    );
  }

  const actions = (p: PatientRow) => (
    <div className="flex items-center justify-end">
      <PatientRowActions patientId={p.id} patientCode={p.patientCode} patientName={p.fullName} canManage={canManage} canDelete={canDelete} />
    </div>
  );

  return (
    <>
      <div className="hidden @4xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
              <th className="py-3 pr-3 pl-5">Patient</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Age / Gender</th>
              <th className="px-3 py-3">Last Visit</th>
              <th className="px-3 py-3">Dentist</th>
              <th className="px-3 py-3">Treatment</th>
              <th className="px-3 py-3 text-right">Outstanding</th>
              <th className="py-3 pr-5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((p) => (
              <tr key={p.id} className="group hover:bg-pale/40 transition-colors">
                <td className="py-3 pr-3 pl-5">
                  <Link href={`/patients/${p.id}`} className="flex min-w-0 items-center gap-3">
                    <PatientAvatar row={p} />
                    <span className="min-w-0">
                      <span className="text-navy group-hover:text-primary block truncate font-semibold transition-colors">{p.fullName}</span>
                      <span className="text-muted-foreground block text-xs tabular-nums">{p.patientCode}</span>
                    </span>
                  </Link>
                </td>
                <td className="text-foreground/80 px-3 py-3 whitespace-nowrap tabular-nums">{p.phone}</td>
                <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">
                  {calculateAge(p.dob)} yrs · {titleCase(p.gender)}
                </td>
                <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">
                  {p.lastVisit ? formatDate(p.lastVisit) : <span className="text-muted-foreground">No visits</span>}
                </td>
                <td className="text-foreground/80 max-w-40 truncate px-3 py-3">{p.dentist ?? <span className="text-muted-foreground">—</span>}</td>
                <td className="px-3 py-3">
                  <StatusBadge status={p.treatmentStatus} />
                </td>
                <td
                  className={cn(
                    "px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums",
                    p.outstandingBalance > 0 ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {money(p.outstandingBalance)}
                </td>
                <td className="py-3 pr-5 pl-3">{actions(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border/60 divide-y @4xl:hidden">
        {rows.map((p) => (
          <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
            <Link href={`/patients/${p.id}`} className="flex min-w-0 items-start gap-3">
              <PatientAvatar row={p} />
              <span className="min-w-0 space-y-1">
                <span className="text-navy block truncate font-semibold">{p.fullName}</span>
                <span className="text-muted-foreground block text-xs tabular-nums">
                  {p.patientCode} · {p.phone}
                </span>
                <span className="flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge status={p.treatmentStatus} />
                  <span className="text-muted-foreground">
                    {calculateAge(p.dob)} yrs · {titleCase(p.gender)}
                  </span>
                </span>
                <span className="text-muted-foreground block text-xs">
                  {p.lastVisit ? `Last visit ${formatDate(p.lastVisit)}` : "No visits yet"}
                  {p.dentist && ` · ${p.dentist}`}
                </span>
              </span>
            </Link>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className={cn("text-sm font-semibold tabular-nums", p.outstandingBalance > 0 ? "text-destructive" : "text-muted-foreground")}>
                {money(p.outstandingBalance)}
              </span>
              {actions(p)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function PatientAvatar({ row }: { row: PatientRow }) {
  return (
    <Avatar className="size-10 shrink-0 ring-2 ring-white">
      {row.photoUrl && <AvatarImage src={row.photoUrl} alt="" className="object-cover" />}
      <AvatarFallback className="text-navy bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold">
        {initialsFromName(row.fullName)}
      </AvatarFallback>
    </Avatar>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = TREATMENT_STATUS[status] ?? TREATMENT_STATUS.NONE;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap", s.className)}>
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden />
      {s.label}
    </span>
  );
}
