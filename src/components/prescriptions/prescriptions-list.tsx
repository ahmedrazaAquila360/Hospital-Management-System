import Link from "next/link";
import { CalendarDays, Download, Eye, Pill, Printer, Stethoscope } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatDate, initialsFromName } from "@/lib/format";

export type PrescriptionRow = {
  id: string;
  date: Date;
  patientName: string;
  patientCode: string;
  patientPhoto: string | null;
  dentistName: string;
  medicines: string[];
};

/** Table on wide cards, stacked cards on narrow ones (container queries on the parent). */
export function PrescriptionsList({ rows, filtered }: { rows: PrescriptionRow[]; filtered: boolean }) {
  if (rows.length === 0) {
    return (
      <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
        <EmptyMedia variant="icon">
          <Pill />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "No matching prescriptions" : "No prescriptions yet"}</EmptyTitle>
        <EmptyDescription>
          {filtered ? "Try a different patient name or doctor." : "Prescriptions you write will appear here."}
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <>
      <div className="hidden @3xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold">
              <th className="py-3 pr-3 pl-5">Patient</th>
              <th className="px-3 py-3">Prescribing Doctor</th>
              <th className="px-3 py-3">Medications</th>
              <th className="px-3 py-3">Date</th>
              <th className="py-3 pr-5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((rx) => (
              <tr key={rx.id} className="hover:bg-pale/40 transition-colors">
                <td className="py-3 pr-3 pl-5">
                  <PatientCell rx={rx} />
                </td>
                <td className="text-foreground/85 px-3 py-3">
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Stethoscope className="text-muted-foreground size-4" aria-hidden /> {rx.dentistName}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Medicines names={rx.medicines} />
                </td>
                <td className="text-foreground/85 px-3 py-3 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="text-muted-foreground size-4" aria-hidden /> {formatDate(rx.date)}
                  </span>
                </td>
                <td className="py-3 pr-5 pl-3">
                  <Actions rx={rx} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border/60 divide-y @3xl:hidden">
        {rows.map((rx) => (
          <li key={rx.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <PatientCell rx={rx} />
              <span className="text-muted-foreground shrink-0 text-xs">{formatDate(rx.date)}</span>
            </div>
            <p className="text-foreground/80 flex items-center gap-1.5 text-sm">
              <Stethoscope className="text-muted-foreground size-4" aria-hidden /> {rx.dentistName}
            </p>
            <Medicines names={rx.medicines} />
            <Actions rx={rx} />
          </li>
        ))}
      </ul>
    </>
  );
}

function PatientCell({ rx }: { rx: PrescriptionRow }) {
  return (
    <Link href={`/prescriptions/${rx.id}`} className="group flex min-w-0 items-center gap-3">
      <Avatar className="size-10 shrink-0">
        {rx.patientPhoto && <AvatarImage src={rx.patientPhoto} alt="" className="object-cover" />}
        <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold text-navy">
          {initialsFromName(rx.patientName)}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0">
        <span className="text-navy group-hover:text-primary block truncate font-semibold transition-colors">{rx.patientName}</span>
        <span className="text-muted-foreground block text-xs tabular-nums">{rx.patientCode}</span>
      </span>
    </Link>
  );
}

function Medicines({ names }: { names: string[] }) {
  const shown = names.slice(0, 2);
  const more = names.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5" title={names.join(", ")}>
      {shown.map((n, i) => (
        <span key={`${n}-${i}`} className="bg-pale text-navy max-w-40 truncate rounded-full px-2.5 py-1 text-xs font-medium">
          {n}
        </span>
      ))}
      {more > 0 && <span className="text-muted-foreground text-xs font-medium">+{more} more</span>}
    </div>
  );
}

function Actions({ rx }: { rx: PrescriptionRow }) {
  const actions = [
    { label: "View prescription", icon: Eye, href: `/prescriptions/${rx.id}` },
    { label: "Print", icon: Printer, href: `/prescriptions/${rx.id}/print`, newTab: true },
    { label: "Download PDF", icon: Download, href: `/api/prescriptions/${rx.id}/pdf`, download: `prescription-${rx.patientCode}.pdf` },
  ];
  return (
    <div className="flex items-center gap-1.5 @3xl:justify-end">
      {actions.map(({ label, icon: Icon, href, newTab, download }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button asChild variant="outline" size="icon" className="size-9 rounded-xl">
              {download ? (
                <a href={href} download={download} aria-label={`${label} for ${rx.patientName}`}>
                  <Icon />
                </a>
              ) : (
                <Link href={href} target={newTab ? "_blank" : undefined} aria-label={`${label} for ${rx.patientName}`}>
                  <Icon />
                </Link>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
