"use client";

import { useRef, useState } from "react";
import { Box, CheckCircle2, ClipboardList, Maximize, Minimize, Presentation, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { parseSurfaces, surfaceLabel, toothName, type ToothConditionKey } from "@/lib/dental";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChartTreatment } from "@/server/dental-chart/queries";
import { DentalChart3D } from "./dental-chart-3d";
import { InteractiveOdontogram } from "./interactive-odontogram";
import { StatusPill } from "./tooth-side-panel";
import { CONDITION_3D } from "./three/visual-states";
import type { SceneTooth } from "./three/dental-scene";
import type { ChartTooth } from "./chart-history";
import type { ChartView } from "./dental-chart-views";

function Section({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: typeof ClipboardList;
  title: string;
  tone: "finding" | "proposed" | "completed";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white/70 p-4">
      <h3
        className={cn(
          "mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide uppercase",
          tone === "finding" && "text-navy",
          tone === "proposed" && "text-primary",
          tone === "completed" && "text-success"
        )}
      >
        <Icon className="size-4" /> {title}
      </h3>
      {children}
    </section>
  );
}

function TreatmentList({ items, empty }: { items: ChartTreatment[]; empty: string }) {
  if (items.length === 0) return <p className="text-muted-foreground text-sm">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2">
      {items.map((t) => (
        <li key={t.id} className="text-sm">
          <p className="font-medium">{t.name}</p>
          <p className="text-muted-foreground text-xs">
            {t.status === "IN_PROGRESS" ? "In progress" : t.status === "PLANNED" ? "Planned" : "Completed"}
            {t.status === "COMPLETED" && t.completedAt ? ` · ${formatDate(t.completedAt)}` : ""}
            {t.description ? ` · ${t.description}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}

/**
 * Chair-side view for explaining the chart to a patient: a large chart and, for the
 * selected tooth, its recorded finding kept apart from proposed and completed
 * treatment. Shows no patient ID, contact or billing details, and has no editing.
 */
export function PresentationMode({
  firstName,
  teeth,
  sceneTeeth,
  treatments,
  selected,
  onSelect,
  view,
  idPrefix,
}: {
  firstName: string;
  teeth: ChartTooth[];
  sceneTeeth: SceneTooth[];
  treatments: ChartTreatment[];
  selected: number | null;
  onSelect: (toothNumber: number | null) => void;
  view: ChartView;
  idPrefix: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ChartView>(view);
  const [fullscreen, setFullscreen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  const tooth = selected !== null ? teeth.find((t) => t.toothNumber === selected) ?? null : null;
  const current = tooth?.conditions.find((c) => c.condition === tooth.currentCondition);
  const surfaces = tooth ? parseSurfaces(current?.surface) : [];
  const forTooth = treatments.filter((t) => selected !== null && t.toothNumbers.includes(selected) && t.status !== "CANCELLED");
  const proposed = forTooth.filter((t) => t.status === "PLANNED" || t.status === "IN_PROGRESS");
  const completed = forTooth.filter((t) => t.status === "COMPLETED");

  const findings = new Map<ToothConditionKey, number[]>();
  for (const t of teeth) {
    if (t.currentCondition === "HEALTHY") continue;
    findings.set(t.currentCondition, [...(findings.get(t.currentCondition) ?? []), t.toothNumber]);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await root.current?.requestFullscreen();
      setFullscreen(Boolean(document.fullscreenElement));
    } catch {
      // Fullscreen can be refused (iframe, browser policy); the overlay still fills the window.
    }
  }

  function changeOpen(next: boolean) {
    setOpen(next);
    if (next) setMode(view);
    if (!next && document.fullscreenElement) void document.exitFullscreen().then(() => setFullscreen(false));
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Presentation className="size-4" /> Present
        </Button>
      </DialogTrigger>
      <DialogContent
        showCloseButton={false}
        className="bg-background flex h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
      >
        <div ref={root} className="bg-background flex min-h-0 flex-1 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3">
            <div>
              <DialogTitle className="text-navy text-lg">{firstName}&apos;s dental chart</DialogTitle>
              <DialogDescription className="text-xs">
                Illustration of the recorded chart — not a diagnostic image.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <div role="group" aria-label="Chart view" className="flex rounded-xl bg-[#e7f0f8] p-1">
                {(["2d", "3d"] as const).map((v) => (
                  <Button
                    key={v}
                    size="sm"
                    variant={mode === v ? "default" : "ghost"}
                    aria-pressed={mode === v}
                    onClick={() => setMode(v)}
                    className="h-8 gap-1.5 px-3"
                  >
                    <Box className="size-4" /> {v.toUpperCase()}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "Full screen"}>
                {fullscreen ? <Minimize /> : <Maximize />}
              </Button>
              <Button variant="ghost" size="icon" onClick={() => changeOpen(false)} aria-label="Close presentation">
                <X />
              </Button>
            </div>
          </header>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:overflow-hidden">
            <div className="flex min-h-0 flex-col justify-center">
              {mode === "3d" ? (
                <DentalChart3D
                  teeth={sceneTeeth}
                  selected={selected}
                  onSelect={(n) => onSelect(n)}
                  compact
                  className="h-[60vh] min-h-[360px] sm:h-full sm:max-h-none"
                />
              ) : (
                <InteractiveOdontogram
                  teeth={teeth}
                  selectedToothNumber={selected}
                  onSelect={(n) => onSelect(n)}
                  focus={null}
                  idPrefix={idPrefix}
                />
              )}
            </div>

            <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto rounded-2xl bg-[#f4f8fc] p-4">
              {tooth ? (
                <>
                  <div>
                    <p className="text-muted-foreground text-xs font-medium">Tooth {tooth.toothNumber}</p>
                    <h2 className="text-navy text-2xl font-semibold tracking-tight">{toothName(tooth.toothNumber)}</h2>
                  </div>

                  <Section icon={ClipboardList} title="Recorded finding" tone="finding">
                    {tooth.currentCondition === "HEALTHY" ? (
                      <p className="text-sm">No finding is recorded for this tooth.</p>
                    ) : (
                      <div className="flex flex-col gap-2 text-sm">
                        <StatusPill condition={tooth.currentCondition} className="w-fit" />
                        {surfaces.length > 0 && (
                          <p>Surfaces: {surfaces.map((s) => surfaceLabel(s, tooth.toothNumber)).join(", ")}</p>
                        )}
                        <p className="text-muted-foreground text-xs">
                          Shown on the model as: {CONDITION_3D[tooth.currentCondition].where.toLowerCase()}.
                          {current?.recordedAt ? ` Recorded ${formatDate(current.recordedAt)}.` : ""}
                        </p>
                        {tooth.notes && <p className="rounded-lg bg-white px-3 py-2">{tooth.notes}</p>}
                      </div>
                    )}
                  </Section>

                  <Section icon={Stethoscope} title="Proposed treatment" tone="proposed">
                    <TreatmentList items={proposed} empty="No treatment is planned for this tooth." />
                  </Section>

                  <Section icon={CheckCircle2} title="Completed treatment" tone="completed">
                    <TreatmentList items={completed} empty="No completed treatment is recorded for this tooth." />
                  </Section>

                  <Button variant="ghost" size="sm" className="self-start" onClick={() => onSelect(null)}>
                    Back to whole-mouth summary
                  </Button>
                </>
              ) : (
                <>
                  <h2 className="text-navy text-xl font-semibold tracking-tight">Whole-mouth summary</h2>
                  <p className="text-muted-foreground text-sm">Select a tooth on the chart to explain it.</p>
                  <Section icon={ClipboardList} title="Recorded findings" tone="finding">
                    {findings.size === 0 ? (
                      <p className="text-sm">No findings are recorded — every tooth is charted as normal.</p>
                    ) : (
                      <ul className="flex flex-col gap-2">
                        {[...findings].map(([condition, numbers]) => (
                          <li key={condition} className="flex items-start justify-between gap-3 text-sm">
                            <StatusPill condition={condition} />
                            <span className="text-muted-foreground text-right tabular-nums">
                              {numbers.length} · {numbers.join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                  <Section icon={Stethoscope} title="Proposed treatment" tone="proposed">
                    <TreatmentList
                      items={treatments.filter((t) => t.status === "PLANNED" || t.status === "IN_PROGRESS")}
                      empty="No treatment is currently planned."
                    />
                  </Section>
                </>
              )}
            </aside>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
