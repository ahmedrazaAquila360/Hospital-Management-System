"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { NotebookPen, Pencil, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { CONDITION_META, toothName, type ToothConditionKey } from "@/lib/dental";
import { formatDate, formatDateTime } from "@/lib/format";
import { updateToothConditionAction } from "@/server/dental-chart/actions";
import type { getDentalChartForPatient } from "@/server/dental-chart/queries";
import { ConditionDot } from "./condition-legend";
import { SectionHeader, ToothChip } from "./procedures-panel";

type Patient = NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>;
type Tooth = NonNullable<Patient["dentalRecord"]>["teeth"][number];

/**
 * Tooth notes are stored on the tooth and saved through the chart's existing
 * `updateToothConditionAction` (keeping the current condition and surface), so every
 * note change is also written to the tooth's history — same as editing in the 2D panel.
 */
function useSaveToothNote(
  onSaved: (toothId: string, condition: ToothConditionKey, notes: string, surface: string) => void,
  onPendingChange: (pending: boolean) => void
) {
  const [isPending, startTransition] = useTransition();
  function save(tooth: Tooth, notes: string, onDone: () => void) {
    const surface = tooth.conditions.find((c) => c.condition === tooth.currentCondition)?.surface ?? "";
    onPendingChange(true);
    startTransition(async () => {
      const result = await updateToothConditionAction({
        toothId: tooth.id,
        condition: tooth.currentCondition,
        notes,
        surface,
      });
      onPendingChange(false);
      if (result.success) {
        toast.success(`Note saved for tooth ${tooth.toothNumber}`);
        onSaved(tooth.id, tooth.currentCondition, notes, surface);
        onDone();
      } else {
        toast.error(result.error ?? "Failed to save note.");
      }
    });
  }
  return { save, isPending };
}

function CurrentNote({
  tooth,
  canManage,
  save,
  isPending,
}: {
  tooth: Tooth;
  canManage: boolean;
  save: (tooth: Tooth, notes: string, onDone: () => void) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(tooth.notes ?? "");
  const latest = tooth.conditions.find((c) => c.notes && c.notes === tooth.notes);

  return (
    <li className="bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ToothChip toothNumber={tooth.toothNumber} condition={tooth.currentCondition} />
          <span className="text-muted-foreground text-xs">
            {toothName(tooth.toothNumber)} · {CONDITION_META[tooth.currentCondition].label}
          </span>
        </div>
        {canManage && !editing && (
          <Button variant="ghost" size="icon" className="size-7" title="Edit note" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} autoFocus />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={() => {
                setDraft(tooth.notes ?? "");
                setEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={isPending || draft === (tooth.notes ?? "")} onClick={() => save(tooth, draft, () => setEditing(false))}>
              {isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{tooth.notes}</p>
      )}
      {latest && (
        <p className="text-muted-foreground flex items-center gap-1 text-xs">
          <UserRound className="size-3" />
          {latest.recordedBy?.name ?? "Unknown"} · {formatDate(latest.recordedAt)}
        </p>
      )}
    </li>
  );
}

export function NotesPanel({
  patient,
  teeth,
  canManage,
  canEditPatient,
  onSaved,
  onPendingChange,
}: {
  patient: Patient;
  teeth: Tooth[];
  canManage: boolean;
  canEditPatient: boolean;
  onSaved: (toothId: string, condition: ToothConditionKey, notes: string, surface: string) => void;
  onPendingChange: (pending: boolean) => void;
}) {
  const { save, isPending } = useSaveToothNote(onSaved, onPendingChange);
  const [newTooth, setNewTooth] = useState<string>("");
  const [newNote, setNewNote] = useState("");

  const withNotes = teeth.filter((t) => t.notes?.trim()).sort((a, b) => a.toothNumber - b.toothNumber);
  const log = teeth
    .flatMap((t) => t.conditions.filter((c) => c.notes?.trim()).map((c) => ({ ...c, toothNumber: t.toothNumber })))
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());

  const target = teeth.find((t) => t.id === newTooth);

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader title="Notes" description="Clinical notes recorded against individual teeth, plus the patient's general notes." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-3">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Current tooth notes ({withNotes.length})
            </h4>
            {withNotes.length === 0 ? (
              <div className="bg-card rounded-xl border">
                <Empty>
                  <EmptyMedia variant="icon">
                    <NotebookPen />
                  </EmptyMedia>
                  <EmptyTitle>No tooth notes yet</EmptyTitle>
                  <EmptyDescription>Notes added to a tooth here or on the chart will appear in this list.</EmptyDescription>
                </Empty>
              </div>
            ) : (
              <ul className="grid gap-2.5 md:grid-cols-2">
                {withNotes.map((t) => (
                  <CurrentNote key={`${t.id}:${t.notes}`} tooth={t} canManage={canManage} save={save} isPending={isPending} />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h4 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Note history</h4>
            {log.length === 0 ? (
              <p className="text-muted-foreground bg-card rounded-xl border px-4 py-5 text-sm">No notes have been recorded yet.</p>
            ) : (
              <ol className="bg-card divide-y rounded-xl border shadow-xs">
                {log.map((c) => (
                  <li key={c.id} className="flex gap-3 px-4 py-3">
                    <ConditionDot condition={c.condition} className="mt-1.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                        <span className="font-medium">Tooth #{c.toothNumber}</span>
                        <span className="text-muted-foreground text-xs">
                          {CONDITION_META[c.condition].label}
                          {c.surface ? ` · ${c.surface}` : ""}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.notes}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {c.recordedBy?.name ?? "Unknown"} · {formatDateTime(c.recordedAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <div className="flex flex-col gap-4">
          {canManage && (
            <section className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-xs">
              <h4 className="text-sm font-semibold">Add a tooth note</h4>
              <Select value={newTooth} onValueChange={setNewTooth}>
                <SelectTrigger className="w-full" aria-label="Tooth">
                  <SelectValue placeholder="Choose a tooth" />
                </SelectTrigger>
                <SelectContent>
                  {[...teeth]
                    .sort((a, b) => a.toothNumber - b.toothNumber)
                    .map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <ConditionDot condition={t.currentCondition} className="size-2" />#{t.toothNumber} · {toothName(t.toothNumber)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {target?.notes && (
                <p className="text-muted-foreground text-xs">This replaces the tooth&apos;s current note; the old one stays in history.</p>
              )}
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={4}
                placeholder="e.g. Sensitive to cold, monitor at next recall"
              />
              <Button
                disabled={!target || !newNote.trim() || isPending}
                onClick={() =>
                  target &&
                  save(target, newNote.trim(), () => {
                    setNewNote("");
                    setNewTooth("");
                  })
                }
              >
                {isPending ? "Saving…" : "Save note"}
              </Button>
            </section>
          )}

          <section className="bg-card flex flex-col gap-2 rounded-xl border p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">General patient notes</h4>
              {canEditPatient && (
                <Link href={`/patients/${patient.id}/edit`} className="text-primary text-xs font-medium hover:underline">
                  Edit
                </Link>
              )}
            </div>
            <p className={patient.notes ? "text-sm whitespace-pre-wrap" : "text-muted-foreground text-sm"}>
              {patient.notes || "No general notes on this patient's record."}
            </p>
            {patient.allergies && (
              <p className="bg-destructive/8 text-destructive rounded-md px-2.5 py-1.5 text-xs font-medium">
                Allergies: {patient.allergies}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
