"use client";

import { useState } from "react";
import Link from "next/link";
import { History as HistoryIcon, Stethoscope } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { StatusBadge } from "@/components/shared/status-badge";
import { CONDITION_META, toothName, type ToothConditionKey } from "@/lib/dental";
import { formatDate, formatTime } from "@/lib/format";
import { TREATMENT_STATUS_ACCENT, TREATMENT_STATUS_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { ChartTreatment, getDentalChartForPatient } from "@/server/dental-chart/queries";
import { ConditionDot } from "./condition-legend";
import { SectionHeader, ToothChip } from "./procedures-panel";

type Tooth = NonNullable<NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>["dentalRecord"]>["teeth"][number];

type Event =
  | {
      kind: "chart";
      id: string;
      at: Date;
      toothNumber: number;
      condition: ToothConditionKey;
      surface: string | null;
      notes: string | null;
      by: string | null;
    }
  | {
      kind: "treatment";
      id: string;
      at: Date;
      step: "Planned" | "Started" | "Completed";
      treatment: ChartTreatment;
    };

const FILTERS = [
  { value: "all", label: "All activity" },
  { value: "chart", label: "Chart entries" },
  { value: "treatment", label: "Treatments" },
] as const;

function buildEvents(teeth: Tooth[], treatments: ChartTreatment[]): Event[] {
  const events: Event[] = [];
  for (const t of teeth) {
    for (const c of t.conditions) {
      events.push({
        kind: "chart",
        id: c.id,
        at: new Date(c.recordedAt),
        toothNumber: t.toothNumber,
        condition: c.condition,
        surface: c.surface,
        notes: c.notes,
        by: c.recordedBy?.name ?? null,
      });
    }
  }
  for (const tr of treatments) {
    events.push({ kind: "treatment", id: `${tr.id}:planned`, at: new Date(tr.createdAt), step: "Planned", treatment: tr });
    if (tr.startDate) events.push({ kind: "treatment", id: `${tr.id}:started`, at: new Date(tr.startDate), step: "Started", treatment: tr });
    if (tr.completedAt)
      events.push({ kind: "treatment", id: `${tr.id}:completed`, at: new Date(tr.completedAt), step: "Completed", treatment: tr });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}

export function HistoryPanel({ teeth, treatments }: { teeth: Tooth[]; treatments: ChartTreatment[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const [tooth, setTooth] = useState("all");
  const toothFilter = tooth === "all" ? null : Number(tooth);

  const all = buildEvents(teeth, treatments);
  const events = all
    .filter((e) => filter === "all" || e.kind === filter)
    .filter((e) =>
      toothFilter === null ? true : e.kind === "chart" ? e.toothNumber === toothFilter : e.treatment.toothNumbers.includes(toothFilter)
    );

  const groups: { day: string; items: Event[] }[] = [];
  for (const e of events) {
    const day = formatDate(e.at, "EEEE, MMM d, yyyy");
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] });
    groups.at(-1)!.items.push(e);
  }

  const teethInHistory = [
    ...new Set(all.flatMap((e) => (e.kind === "chart" ? [e.toothNumber] : e.treatment.toothNumbers))),
  ].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        title="History"
        description="Everything recorded on this patient's chart and treatment plan, newest first."
        actions={
          <>
            <div role="group" aria-label="Activity type" className="bg-muted flex rounded-lg p-[3px]">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={filter === f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                    filter === f.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Select value={tooth} onValueChange={setTooth}>
              <SelectTrigger className="bg-background w-36" aria-label="Filter by tooth">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All teeth</SelectItem>
                {teethInHistory.map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    Tooth #{n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />

      {groups.length === 0 ? (
        <div className="bg-card rounded-xl border">
          <Empty>
            <EmptyMedia variant="icon">
              <HistoryIcon />
            </EmptyMedia>
            <EmptyTitle>No history {filter !== "all" || toothFilter ? "for these filters" : "yet"}</EmptyTitle>
            <EmptyDescription>Chart updates and treatment milestones will build a timeline here.</EmptyDescription>
          </Empty>
        </div>
      ) : (
        <div className="bg-card rounded-xl border p-4 shadow-xs sm:p-6">
          <ol className="flex flex-col gap-6">
            {groups.map((g) => (
              <li key={g.day} className="flex flex-col gap-3">
                <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{g.day}</h4>
                <ol className="border-border relative ml-1.5 flex flex-col gap-3 border-l pl-6">
                  {g.items.map((e) => (
                    <li key={e.id} className="relative">
                      {e.kind === "chart" ? (
                        <>
                          <span className="bg-card absolute top-1 -left-[31px] flex size-3.5 items-center justify-center rounded-full">
                            <ConditionDot condition={e.condition} className="size-3" />
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-medium">{CONDITION_META[e.condition].label}</span>
                            <ToothChip toothNumber={e.toothNumber} />
                            <span className="text-muted-foreground text-xs">
                              {toothName(e.toothNumber)}
                              {e.surface ? ` · ${e.surface}` : ""}
                            </span>
                          </div>
                          {e.notes && <p className="text-foreground/85 mt-1 text-sm">{e.notes}</p>}
                          <p className="text-muted-foreground mt-1 text-xs">
                            Recorded on chart{e.by ? ` by ${e.by}` : ""} · {formatTime(e.at)}
                          </p>
                        </>
                      ) : (
                        <>
                          <span
                            className={cn(
                              "bg-card absolute top-0.5 -left-[33px] flex size-4.5 items-center justify-center rounded-full border",
                              TREATMENT_STATUS_ACCENT[e.treatment.status]?.edge.replace("border-l-", "border-")
                            )}
                          >
                            <Stethoscope className="text-muted-foreground size-2.5" />
                          </span>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-medium">
                              {e.step}:{" "}
                              <Link href={`/treatments/${e.treatment.id}`} className="hover:underline">
                                {e.treatment.name}
                              </Link>
                            </span>
                            {e.treatment.toothNumbers.map((n) => (
                              <ToothChip key={n} toothNumber={n} />
                            ))}
                            {e.step === "Planned" && (
                              <StatusBadge
                                status={e.treatment.status}
                                tone={TREATMENT_STATUS_TONE[e.treatment.status]}
                                className={TREATMENT_STATUS_ACCENT[e.treatment.status]?.badge}
                              />
                            )}
                          </div>
                          <p className="text-muted-foreground mt-1 text-xs">
                            Treatment · Dr. {e.treatment.dentistName.replace(/^Dr\.\s*/, "")}
                          </p>
                        </>
                      )}
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
