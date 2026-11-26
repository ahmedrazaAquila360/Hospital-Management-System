"use client";

import { useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Box, Camera, ClipboardList, ClipboardPlus, Grid2x2, History, NotebookPen, Stethoscope } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InteractiveOdontogram } from "@/components/dental-chart/interactive-odontogram";
import { DentalChart3D } from "@/components/dental-chart/dental-chart-3d";
import { ProceduresPanel } from "@/components/dental-chart/procedures-panel";
import { NotesPanel } from "@/components/dental-chart/notes-panel";
import { HistoryPanel } from "@/components/dental-chart/history-panel";
import { ToothSidePanel } from "@/components/dental-chart/tooth-side-panel";
import { ToothGraphicDefs } from "@/components/dental-chart/tooth-graphic";
import { ConditionLegend } from "@/components/dental-chart/condition-legend";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import { ChartCompareDialog } from "@/components/dental-chart/chart-compare-dialog";
import { PresentationMode } from "@/components/dental-chart/presentation-mode";
import type { SceneTooth } from "@/components/dental-chart/three/dental-scene";
import { CONDITION_META, parseSurfaces, type ToothConditionKey, type ToothSurface } from "@/lib/dental";
import { calculateAge, initialsFromName, titleCase } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ChartTreatment, getDentalChartForPatient } from "@/server/dental-chart/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>;
type Tooth = NonNullable<Patient["dentalRecord"]>["teeth"][number];
export type ChartView = "2d" | "3d";
export type ChartSection = "chart" | "procedures" | "notes" | "history";

// The chart's two views are tabs alongside the clinical sections.
type ChartTab = ChartView | Exclude<ChartSection, "chart">;
const TABS: { value: ChartTab; label: string; icon: typeof ClipboardList }[] = [
  { value: "3d", label: "3D View", icon: Box },
  { value: "2d", label: "2D View", icon: Grid2x2 },
  { value: "procedures", label: "Procedures", icon: Stethoscope },
  { value: "notes", label: "Notes", icon: NotebookPen },
  { value: "history", label: "History", icon: History },
];

function setSearchParam(key: string, value: string | null) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(key, value);
  else url.searchParams.delete(key);
  window.history.replaceState(null, "", url);
}

/**
 * Dental chart workspace: patient header, section tabs, the 2D/3D chart and the
 * Procedures / Notes / History tabs — all views of the same server data. Every
 * save goes through `updateToothConditionAction`, which revalidates this page, so
 * `patient` is the single source of truth; `teeth` is an optimistic copy of it
 * shared by every view and reset whenever `patient` changes.
 */
export function DentalChartViews({
  currency,
  patient,
  treatments,
  canManage,
  canManageTreatments,
  canEditPatient,
  initialView,
  initialSection,
}: {
  currency:string;
  patient: Patient;
  treatments: ChartTreatment[];
  canManage: boolean;
  canManageTreatments: boolean;
  canEditPatient: boolean;
  initialView: ChartView;
  initialSection: ChartSection;
}) {
  const [section, setSection] = useState<ChartSection>(initialSection);
  const [view, setView] = useState<ChartView>(initialView);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [focus, setFocus] = useState<ToothConditionKey | null>(null);
  const [draft, setDraft] = useState<{ toothNumber: number; condition: ToothConditionKey; surfaces: ToothSurface[] } | null>(null);
  const idPrefix = `dcw${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const [syncedPatient, setSyncedPatient] = useState(patient);
  const [teeth, setTeeth] = useState<Tooth[]>(patient.dentalRecord?.teeth ?? []);
  if (patient !== syncedPatient) {
    setSyncedPatient(patient);
    setTeeth(patient.dentalRecord?.teeth ?? []);
  }

  function changeView(v: ChartView) {
    setView(v);
    setSearchParam("view", v === "3d" ? "3d" : null);
  }

  function changeSection(next: string) {
    const s = next as ChartSection;
    setSection(s);
    setSearchParam("tab", s === "chart" ? null : s);
  }

  function changeTab(next: string) {
    if (next === "2d" || next === "3d") {
      changeSection("chart");
      changeView(next);
    } else {
      changeSection(next);
    }
  }

  // Quick actions ask the tooth panel to open its procedure picker or notes editor.
  const [panelIntent, setPanelIntent] = useState<{ kind: "procedure" | "note"; nonce: number } | null>(null);
  const screenshot = useRef<(() => void) | null>(null);

  function handleSaved(toothId: string, condition: ToothConditionKey, notes: string, surface: string) {
    setTeeth((prev) =>
      prev.map((t) =>
        t.id === toothId
          ? {
              ...t,
              currentCondition: condition,
              notes,
              conditions: [
                {
                  id: `optimistic-${Date.now()}`,
                  toothId,
                  condition,
                  notes,
                  surface: surface || null,
                  recordedById: null,
                  recordedBy: null,
                  recordedAt: new Date(),
                } as Tooth["conditions"][number],
                ...t.conditions,
              ],
            }
          : t
      )
    );
  }

  function selectTooth(n: number | null) {
    const next = n === null || selected === n ? null : n;
    if (draft && next !== draft.toothNumber) {
      toast.info(`Unsaved preview on tooth ${draft.toothNumber} was discarded`, {
        description: "Nothing was recorded. Choose the procedure again to save it.",
      });
    }
    setSelected(next);
    setDraft(null);
    // Below xl the panel stacks under the chart — bring it into view.
    if (next !== null && window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => document.getElementById("tooth-side-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const selectedTooth = selected !== null ? teeth.find((t) => t.toothNumber === selected) ?? null : null;
  const showPanel = section === "chart" && selectedTooth !== null;

  // What both chart views draw: saved teeth plus any unsaved procedure being previewed.
  const displayTeeth = useMemo(
    () =>
      teeth.map((t) =>
        draft && t.toothNumber === draft.toothNumber
          ? {
              ...t,
              currentCondition: draft.condition,
              conditions: [
                { ...(t.conditions[0] ?? {}), id: "preview", condition: draft.condition, surface: draft.surfaces.join(", ") || null },
                ...t.conditions,
              ] as Tooth["conditions"],
            }
          : t
      ),
    [teeth, draft]
  );

  const sceneTeeth: SceneTooth[] = useMemo(
    () =>
      displayTeeth.map((t) => ({
        toothNumber: t.toothNumber,
        condition: t.currentCondition,
        surfaces: parseSurfaces(t.conditions.find((c) => c.condition === t.currentCondition)?.surface),
        dimmed: focus !== null && t.currentCondition !== focus,
      })),
    [displayTeeth, focus]
  );

  // Presentation shows the saved record only — never an unsaved preview — and no legend dimming.
  const savedSceneTeeth: SceneTooth[] = useMemo(
    () =>
      teeth.map((t) => ({
        toothNumber: t.toothNumber,
        condition: t.currentCondition,
        surfaces: parseSurfaces(t.conditions.find((c) => c.condition === t.currentCondition)?.surface),
      })),
    [teeth]
  );

  const counts = useMemo(() => {
    const m = new Map<ToothConditionKey, number>();
    for (const t of teeth) m.set(t.currentCondition, (m.get(t.currentCondition) ?? 0) + 1);
    return m;
  }, [teeth]);

  return (
    <div className={cn("grid items-start gap-4", showPanel && "xl:grid-cols-[minmax(0,1fr)_380px]")}>
      <ToothGraphicDefs idPrefix={idPrefix} />

      <div className="surface-card flex min-w-0 flex-col overflow-hidden">
        <header className="flex flex-wrap items-center justify-between gap-3 bg-linear-to-br from-[#eaf6fc] via-white to-white px-4 pt-4 sm:px-6 sm:pt-5">
          <div className="flex items-center gap-3">
            <Button asChild variant="outline" size="icon" className="size-9 rounded-xl" aria-label="Back to patient">
              <Link href={`/patients/${patient.id}`}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <Avatar className="size-12 ring-4 ring-white shadow-md">
              <AvatarFallback className="bg-linear-to-br from-[#4fd0f3] to-[#0b5fae] text-base font-semibold text-white">
                {initialsFromName(patient.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-navy text-xl font-semibold tracking-tight">{patient.fullName}</h2>
              <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="rounded-full bg-white px-2.5 py-0.5 ring-1 ring-border">Age: {calculateAge(patient.dob)}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 font-mono ring-1 ring-border">Patient ID: {patient.patientCode}</span>
                <span className="rounded-full bg-white px-2.5 py-0.5 ring-1 ring-border">{titleCase(patient.gender)}</span>
              </p>
            </div>
          </div>

          {section === "chart" && (
            <div className="flex flex-wrap items-center gap-2">
              <ChartCompareDialog teeth={teeth} selected={selected} onSelect={selectTooth} idPrefix={idPrefix} />
              <PresentationMode
                firstName={patient.fullName.split(" ")[0]}
                teeth={teeth}
                sceneTeeth={savedSceneTeeth}
                treatments={treatments}
                selected={selected}
                onSelect={setSelected}
                view={view}
                idPrefix={idPrefix}
              />
            </div>
          )}
        </header>

        <Tabs value={section === "chart" ? view : section} onValueChange={changeTab} className="bg-white pt-3">
          <TabsList
            variant="line"
            aria-label="Dental chart sections"
            className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-b px-4 pb-0 sm:px-6"
          >
            {TABS.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="data-active:text-primary after:bg-primary flex-none px-3 pt-1 pb-3 text-sm group-data-horizontal/tabs:after:bottom-0 group-data-horizontal/tabs:after:h-0.5"
              >
                <Icon /> {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="p-4 sm:p-6">
          {section === "chart" && (
            <div className="flex flex-col gap-4" aria-busy={saving}>
              {view === "2d" ? (
                <>
                  <ConditionLegend counts={counts} active={focus} onToggle={setFocus} layout="strip" />
                  <InteractiveOdontogram
                    teeth={displayTeeth}
                    selectedToothNumber={selected}
                    onSelect={selectTooth}
                    focus={focus}
                    idPrefix={idPrefix}
                  />
                </>
              ) : (
                <DentalChart3D
                  teeth={sceneTeeth}
                  selected={selected}
                  onSelect={selectTooth}
                  legend={<ConditionLegend counts={counts} active={focus} onToggle={setFocus} layout="rail" />}
                  screenshotRef={screenshot}
                />
              )}

              {selectedTooth ? (
                <div className="bg-card flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border px-3 py-2 shadow-xs">
                  <span className="text-primary flex items-center gap-2 pr-2 text-sm font-medium">
                    <span className="bg-pale flex size-8 items-center justify-center rounded-lg">
                      <ToothIcon className="size-4" />
                    </span>
                    Tooth {selectedTooth.toothNumber} – {CONDITION_META[selectedTooth.currentCondition].label}
                  </span>
                  <div className="flex flex-1 flex-wrap items-center justify-end gap-1">
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setPanelIntent((p) => ({ kind: "procedure", nonce: (p?.nonce ?? 0) + 1 }))}>
                        <ClipboardPlus /> Add Procedure
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="sm" onClick={() => setPanelIntent((p) => ({ kind: "note", nonce: (p?.nonce ?? 0) + 1 }))}>
                        <NotebookPen /> Add Note
                      </Button>
                    )}
                    {canManageTreatments && (
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/treatments/new?patientId=${patient.id}&toothNumber=${selectedTooth.toothNumber}`}>
                          <Stethoscope /> Add to Treatment Plan
                        </Link>
                      </Button>
                    )}
                    {view === "3d" && (
                      <Button variant="ghost" size="sm" onClick={() => screenshot.current?.()}>
                        <Camera /> Take Screenshot
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
              <div className="bg-pale flex items-center gap-3 rounded-xl border border-[#d3e8f5] px-4 py-3">
                <span className="bg-background text-primary flex size-10 shrink-0 items-center justify-center rounded-lg shadow-xs">
                  <ToothIcon className="size-5" />
                </span>
                <div className="text-sm">
                  <p className="font-medium">Click on a tooth to view details or add/edit procedures.</p>
                  <p className="text-muted-foreground text-xs">
                    {view === "3d"
                      ? "Drag to rotate, scroll to zoom, right-drag to pan. Click a status in the legend to highlight those teeth."
                      : "Use the legend above to understand — or highlight — each tooth status."}
                  </p>
                </div>
              </div>
              )}
            </div>
          )}

          {section === "procedures" && (
            <ProceduresPanel
              currency={currency}
              treatments={treatments}
              teeth={teeth}
              patientId={patient.id}
              canManageTreatments={canManageTreatments}
            />
          )}

          {section === "notes" && (
            <NotesPanel
              patient={patient}
              teeth={teeth}
              canManage={canManage}
              canEditPatient={canEditPatient}
              onSaved={handleSaved}
              onPendingChange={setSaving}
            />
          )}

          {section === "history" && <HistoryPanel teeth={teeth} treatments={treatments} />}
        </div>
      </div>

      {showPanel && (
        <ToothSidePanel
          tooth={selectedTooth}
          patientId={patient.id}
          canManage={canManage}
          idPrefix={idPrefix}
          onClose={() => selectTooth(null)}
          onOpenHistory={() => changeSection("history")}
          onSaved={handleSaved}
          onPendingChange={setSaving}
          onDraftChange={(d) => setDraft(d && { toothNumber: selectedTooth.toothNumber, ...d })}
          intent={panelIntent}
        />
      )}
    </div>
  );
}
