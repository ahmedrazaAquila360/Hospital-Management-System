import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown, Stethoscope, UserRound } from "lucide-react";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { TreatmentRowActions } from "@/components/treatments/treatment-row-actions";
import { formatCurrency, formatDate } from "@/lib/format";
import { TREATMENT_STATUS_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { TreatmentStatus } from "@/generated/prisma/enums";

export type TreatmentRow = {
  id: string;
  name: string;
  patientId: string;
  patientName: string;
  dentistName: string;
  teeth: number[];
  netCost: number;
  startDate: Date | null;
  status: TreatmentStatus;
};

const STATUS_STYLE: Record<string, string> = {
  PLANNED: "bg-blue-50 text-blue-700 ring-blue-200",
  IN_PROGRESS: "bg-amber-50 text-amber-800 ring-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-slate-200",
};

export function TreatmentStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ring-1 ring-inset",
        STATUS_STYLE[status] ?? STATUS_STYLE.PLANNED
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {TREATMENT_STATUS_LABEL[status] ?? status}
    </span>
  );
}

/** Treatment list: table on wide containers, cards on narrow ones. Must sit inside `@container`. */
export function TreatmentsTable({
  rows,
  canEdit,
  canDelete,
  filtered,
  sort,
  sortHref,
}: {
  rows: TreatmentRow[];
  canEdit: boolean;
  canDelete: boolean;
  filtered: boolean;
  sort?: "date_asc" | "date_desc";
  /** Link that applies the next date order (newest → oldest → default). */
  sortHref: string;
}) {
  if (rows.length === 0) {
    return (
      <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
        <EmptyMedia variant="icon">
          <Stethoscope />
        </EmptyMedia>
        <EmptyTitle>{filtered ? "No matching treatments" : "No treatments yet"}</EmptyTitle>
        <EmptyDescription>{filtered ? "Try a different name, status or dentist, or reset the filters." : "Create a treatment plan to start tracking care."}</EmptyDescription>
      </Empty>
    );
  }

  const SortIcon = sort === "date_asc" ? ArrowUp : sort === "date_desc" ? ArrowDown : ArrowUpDown;
  const teethLabel = (t: TreatmentRow) => (t.teeth.length ? t.teeth.join(", ") : "—");

  return (
    <>
      <div className="hidden @5xl:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold tracking-wide uppercase">
              <th className="py-3 pr-3 pl-5">Patient</th>
              <th className="px-3 py-3">Treatment</th>
              <th className="px-3 py-3">Dentist</th>
              <th className="px-3 py-3">Teeth</th>
              <th className="px-3 py-3 text-right">Cost</th>
              <th className="px-3 py-3" aria-sort={sort === "date_asc" ? "ascending" : sort === "date_desc" ? "descending" : "none"}>
                <Link href={sortHref} scroll={false} className="hover:text-navy inline-flex items-center gap-1 uppercase">
                  Date <SortIcon className="size-3.5" aria-hidden />
                  <span className="sr-only">(change sort order)</span>
                </Link>
              </th>
              <th className="px-3 py-3">Status</th>
              <th className="py-3 pr-5 pl-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {rows.map((t) => (
              <tr key={t.id} className="group hover:bg-pale/40 transition-colors">
                <td className="py-3 pr-3 pl-5">
                  <Link href={`/patients/${t.patientId}`} className="text-navy hover:text-primary flex items-center gap-3 font-semibold">
                    <span className="bg-pale text-brand flex size-9 shrink-0 items-center justify-center rounded-full" aria-hidden>
                      <UserRound className="size-4" />
                    </span>
                    <span className="truncate">{t.patientName}</span>
                  </Link>
                </td>
                <td className="px-3 py-3">
                  <Link href={`/treatments/${t.id}`} className="text-foreground/90 hover:text-primary font-medium">
                    {t.name}
                  </Link>
                </td>
                <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">{t.dentistName}</td>
                <td className="text-foreground/80 max-w-32 truncate px-3 py-3 tabular-nums" title={teethLabel(t)}>
                  {teethLabel(t)}
                </td>
                <td className="text-navy px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatCurrency(t.netCost)}</td>
                <td className="text-foreground/80 px-3 py-3 whitespace-nowrap">{t.startDate ? formatDate(t.startDate) : <span className="text-muted-foreground">Not set</span>}</td>
                <td className="px-3 py-3">
                  <TreatmentStatusPill status={t.status} />
                </td>
                <td className="py-3 pr-5 pl-3 text-right">
                  <TreatmentRowActions id={t.id} name={t.name} patientName={t.patientName} status={t.status} canEdit={canEdit} canDelete={canDelete} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-border/60 divide-y @5xl:hidden">
        {rows.map((t) => (
          <li key={t.id} className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
            <div className="min-w-0 space-y-1.5">
              <Link href={`/treatments/${t.id}`} className="text-navy block font-semibold">
                {t.name}
              </Link>
              <p className="text-muted-foreground text-xs">
                <Link href={`/patients/${t.patientId}`} className="text-foreground/80 hover:text-primary font-medium">
                  {t.patientName}
                </Link>{" "}
                · {t.dentistName}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <TreatmentStatusPill status={t.status} />
                <span className="text-muted-foreground">{t.startDate ? formatDate(t.startDate) : "No start date"}</span>
                {t.teeth.length > 0 && <span className="text-muted-foreground">· Teeth {teethLabel(t)}</span>}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="text-navy font-semibold tabular-nums">{formatCurrency(t.netCost)}</span>
              <TreatmentRowActions id={t.id} name={t.name} patientName={t.patientName} status={t.status} canEdit={canEdit} canDelete={canDelete} />
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
