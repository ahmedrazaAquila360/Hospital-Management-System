"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, Stethoscope, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONDITION_META, parseSurfaces, surfaceLabel, toothName, type ToothConditionKey } from "@/lib/dental";
import { formatCurrency, formatDate } from "@/lib/format";
import { TREATMENT_STATUS_ACCENT, TREATMENT_STATUS_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ChartTreatment, getDentalChartForPatient } from "@/server/dental-chart/queries";
import { ConditionDot } from "./condition-legend";
import { ToothGraphic, ToothGraphicDefs } from "./tooth-graphic";

type Tooth = NonNullable<NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>["dentalRecord"]>["teeth"][number];

const STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
const STATUS_LABEL: Record<(typeof STATUSES)[number], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
const STATUS_TEXT: Record<(typeof STATUSES)[number], string> = {
  PLANNED: "text-primary",
  IN_PROGRESS: "text-warning-foreground",
  COMPLETED: "text-success",
  CANCELLED: "text-destructive",
};

/** Conditions that represent work done on a tooth (as opposed to findings like caries). */
const PROCEDURE_CONDITIONS: ToothConditionKey[] = ["FILLED", "ROOT_CANAL", "CROWN", "IMPLANT", "BRIDGE", "EXTRACTION"];

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ToothChip({ toothNumber, condition }: { toothNumber: number; condition?: ToothConditionKey }) {
  return (
    <span
      title={toothName(toothNumber)}
      className="bg-background inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium tabular-nums"
    >
      {condition && condition !== "HEALTHY" && <ConditionDot condition={condition} className="size-2" />}#{toothNumber}
    </span>
  );
}

export function ProceduresPanel({
  treatments,
  teeth,
  patientId,
  canManageTreatments,
}: {
  treatments: ChartTreatment[];
  teeth: Tooth[];
  patientId: string;
  canManageTreatments: boolean;
}) {
  const [status, setStatus] = useState<(typeof STATUSES)[number] | null>(null);
  const [tooth, setTooth] = useState<string>("all");
  const idPrefix = `proc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const conditionOf = new Map(teeth.map((t) => [t.toothNumber, t.currentCondition]));
  const toothFilter = tooth === "all" ? null : Number(tooth);

  const charted = teeth
    .filter((t) => PROCEDURE_CONDITIONS.includes(t.currentCondition))
    .filter((t) => toothFilter === null || t.toothNumber === toothFilter);
  const filtered = treatments
    .filter((t) => status === null || t.status === status)
    .filter((t) => toothFilter === null || t.toothNumbers.includes(toothFilter));

  const teethWithProcedures = [
    ...new Set([
      ...treatments.flatMap((t) => t.toothNumbers),
      ...teeth.filter((t) => PROCEDURE_CONDITIONS.includes(t.currentCondition)).map((t) => t.toothNumber),
    ]),
  ].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-5">
      <ToothGraphicDefs idPrefix={idPrefix} />
      <SectionHeader
        title="Procedures"
        description="Treatment plans and procedures for this patient, and restorations recorded on the chart."
        actions={
          <>
            <Select value={tooth} onValueChange={setTooth}>
              <SelectTrigger className="bg-background w-40" aria-label="Filter by tooth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teeth</SelectItem>
                {teethWithProcedures.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Tooth #{n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canManageTreatments && (
              <Button asChild>
                <Link href={`/treatments/new?patientId=${patientId}${toothFilter ? `&toothNumber=${toothFilter}` : ""}`}>
                  <Plus /> New procedure
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4" role="group" aria-label="Filter by status">
        {STATUSES.map((s) => {
          const count = treatments.filter((t) => t.status === s).length;
          const active = status === s;
          return (
            <button
              key={s}
              type="button"
              aria-pressed={active}
              onClick={() => setStatus(active ? null : s)}
              className={cn(
                "bg-card flex flex-col items-start gap-1 rounded-xl border border-l-4 px-4 py-3 text-left shadow-xs transition-all",
                "hover:shadow-sm",
                TREATMENT_STATUS_ACCENT[s].edge,
                active && "ring-primary/40 bg-primary/5 ring-2"
              )}
            >
              <span className={cn("text-2xl leading-none font-semibold tabular-nums", STATUS_TEXT[s])}>{count}</span>
              <span className="text-muted-foreground text-xs font-medium">{STATUS_LABEL[s]}</span>
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Treatment procedures{status ? ` · ${STATUS_LABEL[status]}` : ""}
          </h4>
          {(status || toothFilter) && (
            <button
              type="button"
              onClick={() => {
                setStatus(null);
                setTooth("all");
              }}
              className="text-primary text-xs font-medium hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="bg-card rounded-xl border">
            <Empty>
              <EmptyMedia variant="icon">
                <Stethoscope />
              </EmptyMedia>
              <EmptyTitle>No procedures {status || toothFilter ? "match these filters" : "yet"}</EmptyTitle>
              <EmptyDescription>Procedures created for this patient will appear here with their status and teeth.</EmptyDescription>
            </Empty>
          </div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {filtered.map((t) => {
              const net = t.cost - t.discount;
              return (
                <li
                  key={t.id}
                  className={cn(
                    "bg-card flex flex-col gap-3 rounded-xl border border-l-4 p-4 shadow-xs transition-shadow hover:shadow-sm sm:flex-row sm:items-center",
                    TREATMENT_STATUS_ACCENT[t.status]?.edge
                  )}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/treatments/${t.id}`} className="font-medium hover:underline">
                        {t.name}
                      </Link>
                      <StatusBadge
                        status={t.status}
                        tone={TREATMENT_STATUS_TONE[t.status]}
                        className={TREATMENT_STATUS_ACCENT[t.status]?.badge}
                      />
                    </div>
                    {t.description && <p className="text-muted-foreground line-clamp-1 text-sm">{t.description}</p>}
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1">
                        <UserRound className="size-3.5" /> Dr. {t.dentistName.replace(/^Dr\.\s*/, "")}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3.5" />
                        {t.completedAt
                          ? `Completed ${formatDate(t.completedAt)}`
                          : t.startDate
                            ? `Started ${formatDate(t.startDate)}`
                            : `Planned ${formatDate(t.createdAt)}`}
                        {!t.completedAt && t.expectedCompletionDate && ` · due ${formatDate(t.expectedCompletionDate)}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1.5">
                    <div className="flex flex-wrap gap-1 sm:justify-end">
                      {t.toothNumbers.length === 0 ? (
                        <span className="text-muted-foreground text-xs">No teeth linked</span>
                      ) : (
                        t.toothNumbers.map((n) => <ToothChip key={n} toothNumber={n} condition={conditionOf.get(n)} />)
                      )}
                    </div>
                    <span className="text-sm font-semibold tabular-nums">{formatCurrency(net)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Charted on the tooth chart</h4>
        {charted.length === 0 ? (
          <p className="text-muted-foreground bg-card rounded-xl border px-4 py-5 text-sm">
            No fillings, crowns, root canals, implants, bridges or extractions recorded on the chart
            {toothFilter ? ` for tooth #${toothFilter}` : ""}.
          </p>
        ) : (
          <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {charted.map((t) => {
              const entry = t.conditions.find((c) => c.condition === t.currentCondition);
              const surfaces = parseSurfaces(entry?.surface);
              return (
                <li key={t.id} className="bg-card flex items-center gap-3 rounded-xl border p-3 shadow-xs">
                  <div className="bg-muted/50 flex h-16 w-10 shrink-0 items-center justify-center rounded-lg">
                    <ToothGraphic
                      toothNumber={t.toothNumber}
                      condition={t.currentCondition}
                      surfaces={surfaces}
                      idPrefix={idPrefix}
                      className="h-14 w-7"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      <ConditionDot condition={t.currentCondition} className="size-2" />
                      {CONDITION_META[t.currentCondition].label}
                      <span className="text-muted-foreground font-normal">· #{t.toothNumber}</span>
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{toothName(t.toothNumber)}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {surfaces.length > 0 && `${surfaces.map((s) => surfaceLabel(s, t.toothNumber)).join(", ")} · `}
                      {entry ? formatDate(entry.recordedAt) : "Date not recorded"}
                      {entry?.recordedBy ? ` · ${entry.recordedBy.name}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
