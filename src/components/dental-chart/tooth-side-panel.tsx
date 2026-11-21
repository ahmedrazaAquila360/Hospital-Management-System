"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Stethoscope, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONDITION_META,
  TOOTH_CONDITIONS,
  TOOTH_SURFACES,
  parseSurfaces,
  quadrantLabel,
  surfaceLabel,
  toothName,
  toothType,
  type ToothConditionKey,
  type ToothSurface,
} from "@/lib/dental";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { updateToothConditionAction } from "@/server/dental-chart/actions";
import type { getDentalChartForPatient } from "@/server/dental-chart/queries";
import { ConditionDot } from "./condition-legend";
import { ToothGraphic, isUpperTooth } from "./tooth-graphic";
import { CONDITION_3D } from "./three/visual-states";

type Tooth = NonNullable<NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>["dentalRecord"]>["teeth"][number];

const TREATMENT_BADGE: Record<string, { label: string; className: string; dot: string }> = {
  PLANNED: { label: "Planned", className: "text-primary border-primary/30 bg-primary/5", dot: "#3b82f6" },
  IN_PROGRESS: { label: "Active", className: "text-primary border-primary/30 bg-primary/5", dot: "#3b82f6" },
  COMPLETED: { label: "Completed", className: "text-success border-success/30 bg-success/8", dot: "#64748b" },
  CANCELLED: { label: "Cancelled", className: "text-destructive border-destructive/30 bg-destructive/5", dot: "#ef4444" },
};

export function StatusPill({ condition, className }: { condition: ToothConditionKey; className?: string }) {
  const color = CONDITION_META[condition].color;
  const plain = condition === "HEALTHY" || condition === "MISSING";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", className)}
      style={
        plain
          ? { background: "var(--muted)", color: "var(--muted-foreground)" }
          : { background: `color-mix(in oklab, ${color} 14%, transparent)`, color: `color-mix(in oklab, ${color} 80%, black)` }
      }
    >
      <ConditionDot condition={condition} className="size-2.5" />
      {CONDITION_META[condition].label}
    </span>
  );
}

function PanelCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        {action}
      </header>
      <div className="px-4 py-3">{children}</div>
    </section>
  );
}

export function ToothSidePanel({
  tooth,
  patientId,
  canManage,
  idPrefix,
  onClose,
  onOpenHistory,
  onSaved,
  onPendingChange,
  onDraftChange,
  intent,
}: {
  tooth: Tooth;
  patientId: string;
  canManage: boolean;
  idPrefix: string;
  onClose: () => void;
  onOpenHistory: () => void;
  onSaved: (toothId: string, condition: ToothConditionKey, notes: string, surface: string) => void;
  onPendingChange: (pending: boolean) => void;
  /** Unsaved procedure choice, so the chart (2D or 3D) can preview it on the tooth. */
  onDraftChange?: (draft: { condition: ToothConditionKey; surfaces: ToothSurface[] } | null) => void;
  /** From the chart's quick actions: open the procedure picker or the notes editor. */
  intent?: { kind: "procedure" | "note"; nonce: number } | null;
}) {
  const [procedure, setProcedure] = useState<ToothConditionKey | "">("");
  const [surfaces, setSurfaces] = useState<ToothSurface[]>([]);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(tooth.notes ?? "");
  const [isPending, startTransition] = useTransition();

  const [lastIntent, setLastIntent] = useState(intent?.nonce);
  if (intent && intent.nonce !== lastIntent) {
    setLastIntent(intent.nonce);
    if (intent.kind === "note" && canManage) setEditingNotes(true);
  }
  useEffect(() => {
    if (!intent) return;
    const target = document.getElementById(intent.kind === "note" ? "tooth-notes-editor" : "tooth-procedure-picker");
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (intent.kind === "procedure") target?.focus();
  }, [intent]);

  // Reset the form whenever another tooth is selected.
  const [lastToothId, setLastToothId] = useState(tooth.id);
  if (tooth.id !== lastToothId) {
    setLastToothId(tooth.id);
    setProcedure("");
    setSurfaces([]);
    setEditingNotes(false);
    setNotesDraft(tooth.notes ?? "");
  }

  const current = tooth.conditions.find((c) => c.condition === tooth.currentCondition);
  const currentSurfaces = parseSurfaces(current?.surface);
  // Note edits re-record the same condition; collapse consecutive repeats so the list shows real changes.
  const changes = tooth.conditions.filter((c, i, all) => i === 0 || c.condition !== all[i - 1].condition);
  const previous = changes[0]?.condition === tooth.currentCondition ? changes.slice(1) : changes;
  const upper = isUpperTooth(tooth.toothNumber);

  function save(condition: ToothConditionKey, notes: string, surface: string, done: () => void) {
    onPendingChange(true);
    startTransition(async () => {
      const result = await updateToothConditionAction({ toothId: tooth.id, condition, notes, surface });
      onPendingChange(false);
      if (result.success) {
        toast.success(`Tooth ${tooth.toothNumber} updated to ${CONDITION_META[condition].label}`);
        onSaved(tooth.id, condition, notes, surface);
        done();
      } else {
        toast.error(result.error ?? "Failed to update tooth.");
      }
    });
  }

  function saveProcedure() {
    if (!procedure) return;
    const surfaceText = surfaces.map((s) => surfaceLabel(s, tooth.toothNumber)).join(", ");
    save(procedure, tooth.notes ?? "", surfaceText, () => {
      setProcedure("");
      setSurfaces([]);
      onDraftChange?.(null);
    });
  }

  function saveNotes() {
    save(tooth.currentCondition, notesDraft.trim(), current?.surface ?? "", () => setEditingNotes(false));
  }

  const procedures = [
    ...(tooth.currentCondition !== "HEALTHY"
      ? [
          {
            key: "current",
            dot: <ConditionDot condition={tooth.currentCondition} className="size-3" />,
            title: CONDITION_META[tooth.currentCondition].label,
            detail: [
              currentSurfaces.map((s) => surfaceLabel(s, tooth.toothNumber)).join(", "),
              current ? formatDate(current.recordedAt, "yyyy-MM-dd") : null,
            ]
              .filter(Boolean)
              .join(" · "),
            badge: { label: "Current", className: "text-primary border-primary/30 bg-primary/5" },
            href: undefined as string | undefined,
          },
        ]
      : []),
    ...tooth.treatmentTeeth.map((tt) => {
      const t = tt.treatment;
      const b = TREATMENT_BADGE[t.status];
      return {
        key: tt.id,
        dot: <span className="size-3 shrink-0 rounded-full" style={{ background: b.dot }} />,
        title: t.name,
        detail: formatDate(t.completedAt ?? t.startDate ?? t.createdAt, "yyyy-MM-dd"),
        badge: b,
        href: `/treatments/${t.id}`,
      };
    }),
    ...previous.slice(0, 3).map((c) => ({
      key: c.id,
      dot: <ConditionDot condition={c.condition} className="size-3 opacity-70" />,
      title: `Previous ${CONDITION_META[c.condition].label}`,
      detail: formatDate(c.recordedAt, "yyyy-MM-dd"),
      badge: { label: "Recorded", className: "text-muted-foreground border-border bg-muted/60" },
      href: undefined as string | undefined,
    })),
  ];

  return (
    <aside
      id="tooth-side-panel"
      className="bg-card flex scroll-mt-4 flex-col rounded-2xl border shadow-sm lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <button type="button" onClick={onClose} className="text-primary flex items-center gap-1.5 text-sm font-medium hover:underline">
          <ArrowLeft className="size-4" /> Back to Chart
        </button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close tooth panel">
          <X className="size-4" />
        </Button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto p-3">
        <div className="flex items-center gap-4 px-1 py-2">
          <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_50%_40%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_70%)]">
            <ToothGraphic
              toothNumber={tooth.toothNumber}
              condition={tooth.currentCondition}
              surfaces={currentSurfaces}
              idPrefix={idPrefix}
              className="h-32 w-16 drop-shadow-[0_4px_6px_rgb(60_40_20/0.18)]"
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h3 className="text-xl font-semibold tracking-tight">Tooth #{tooth.toothNumber}</h3>
            <p className="text-muted-foreground text-sm">{toothName(tooth.toothNumber)}</p>
            <StatusPill condition={tooth.currentCondition} className="w-fit" />
          </div>
        </div>

        <PanelCard title="Tooth Information">
          <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2.5 text-sm">
            <dt className="text-muted-foreground">Tooth Number</dt>
            <dd className="font-medium">{tooth.toothNumber}</dd>
            <dt className="text-muted-foreground">Tooth Name</dt>
            <dd>{toothName(tooth.toothNumber)}</dd>
            <dt className="text-muted-foreground">Tooth Type</dt>
            <dd>
              {toothType(tooth.toothNumber)} · Permanent
            </dd>
            <dt className="text-muted-foreground">Jaw</dt>
            <dd>
              {upper ? "Upper" : "Lower"} · {quadrantLabel(tooth.toothNumber).split(" ")[1]} side
            </dd>
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <StatusPill condition={tooth.currentCondition} />
            </dd>
            {currentSurfaces.length > 0 && (
              <>
                <dt className="text-muted-foreground">Surfaces</dt>
                <dd>{currentSurfaces.map((s) => surfaceLabel(s, tooth.toothNumber)).join(", ")}</dd>
              </>
            )}
          </dl>
        </PanelCard>

        <PanelCard
          title="Current Procedures"
          action={
            tooth.conditions.length > 0 && (
              <button type="button" onClick={onOpenHistory} className="text-primary text-xs font-medium hover:underline">
                Full history
              </button>
            )
          }
        >
          {procedures.length === 0 ? (
            <p className="text-muted-foreground py-1 text-sm">No procedures recorded for this tooth.</p>
          ) : (
            <ul className="-my-1 divide-y">
              {procedures.map((p) => (
                <li key={p.key} className="flex items-center gap-3 py-2.5">
                  {p.dot}
                  <div className="min-w-0 flex-1">
                    {p.href ? (
                      <Link href={p.href} className="block truncate text-sm font-medium hover:underline">
                        {p.title}
                      </Link>
                    ) : (
                      <p className="truncate text-sm font-medium">{p.title}</p>
                    )}
                    {p.detail && <p className="text-muted-foreground text-xs tabular-nums">{p.detail}</p>}
                  </div>
                  <span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", p.badge.className)}>{p.badge.label}</span>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title="Notes"
          action={
            canManage &&
            !editingNotes && (
              <Button variant="ghost" size="icon" className="size-7" title="Edit notes" onClick={() => setEditingNotes(true)}>
                <Pencil className="size-3.5" />
              </Button>
            )
          }
        >
          {editingNotes ? (
            <div className="flex flex-col gap-2">
              <Textarea
                id="tooth-notes-editor"
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => {
                    setNotesDraft(tooth.notes ?? "");
                    setEditingNotes(false);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={isPending || notesDraft.trim() === (tooth.notes ?? "")} onClick={saveNotes}>
                  {isPending ? "Saving…" : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <p className={cn("text-sm whitespace-pre-wrap", !tooth.notes && "text-muted-foreground")}>
              {tooth.notes || "No notes for this tooth."}
            </p>
          )}
        </PanelCard>

        {canManage && (
          <section className="flex flex-col gap-3 px-1 pt-2 pb-1">
            <h4 className="text-base font-semibold">Add / Update Procedure</h4>
            <Select
              value={procedure}
              onValueChange={(v) => {
                setProcedure(v as ToothConditionKey);
                onDraftChange?.({ condition: v as ToothConditionKey, surfaces });
              }}
            >
              <SelectTrigger id="tooth-procedure-picker" className="bg-background h-10 w-full">
                <SelectValue placeholder="Select procedure" />
              </SelectTrigger>
              <SelectContent>
                {TOOTH_CONDITIONS.map((c) => (
                  <SelectItem key={c} value={c}>
                    <ConditionDot condition={c} />
                    {CONDITION_META[c].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {procedure && CONDITION_3D[procedure].usesSurface && (
              <div className="flex flex-col gap-1.5">
                <span className="text-muted-foreground text-xs font-medium">Surfaces</span>
                <div className="flex flex-wrap gap-1">
                  {TOOTH_SURFACES.map((s) => {
                    const on = surfaces.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = on ? surfaces.filter((x) => x !== s) : TOOTH_SURFACES.filter((x) => x === s || surfaces.includes(x));
                          setSurfaces(next);
                          if (procedure) onDraftChange?.({ condition: procedure, surfaces: next });
                        }}
                        className={cn(
                          "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                          on ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent"
                        )}
                      >
                        {surfaceLabel(s, tooth.toothNumber)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {procedure && (
              <div className="flex items-center justify-between gap-2">
                <p className="text-primary text-xs font-medium">Previewing on the chart — not saved yet.</p>
                <button
                  type="button"
                  className="text-muted-foreground text-xs hover:underline"
                  onClick={() => {
                    setProcedure("");
                    setSurfaces([]);
                    onDraftChange?.(null);
                  }}
                >
                  Discard
                </button>
              </div>
            )}
            <Button size="lg" className="w-full" disabled={!procedure || isPending} onClick={saveProcedure}>
              {isPending ? "Saving…" : "Save Procedure"}
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href={`/treatments/new?patientId=${patientId}&toothNumber=${tooth.toothNumber}`}>
                <Stethoscope /> Create treatment plan for this tooth
              </Link>
            </Button>
          </section>
        )}
      </div>
    </aside>
  );
}
