"use client";

import { useMemo, useState } from "react";
import { ArrowRight, GitCompareArrows } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CONDITION_META, toothName } from "@/lib/dental";
import { formatDate } from "@/lib/format";
import { InteractiveOdontogram } from "./interactive-odontogram";
import { StatusPill } from "./tooth-side-panel";
import { chartAsOf, recordedDays, type ChartTooth } from "./chart-history";

/**
 * Before/after view of the recorded chart: the status every tooth had at the end of a
 * chosen day versus today, rebuilt from saved condition history only. Read-only —
 * clicking a tooth selects it in the main chart.
 */
export function ChartCompareDialog({
  teeth,
  selected,
  onSelect,
  idPrefix,
}: {
  teeth: ChartTooth[];
  selected: number | null;
  onSelect: (toothNumber: number) => void;
  idPrefix: string;
}) {
  const days = useMemo(() => recordedDays(teeth), [teeth]);
  // Default to the day before the most recent change, so there is something to compare.
  const [beforeKey, setBeforeKey] = useState<string | null>(null);
  const [changesOnly, setChangesOnly] = useState(false);
  const before = days.find((d) => d.toISOString() === beforeKey) ?? days[1] ?? days[0] ?? null;

  const past = useMemo(() => (before ? chartAsOf(teeth, before) : []), [teeth, before]);
  const changes = useMemo(
    () =>
      past
        .map(({ tooth, unrecorded }) => {
          const now = teeth.find((t) => t.toothNumber === tooth.toothNumber)!;
          return { toothNumber: tooth.toothNumber, from: tooth.currentCondition, to: now.currentCondition, unrecorded, at: now.conditions[0]?.recordedAt };
        })
        .filter((c) => c.from !== c.to)
        .sort((a, b) => a.toothNumber - b.toothNumber),
    [past, teeth]
  );
  const changed = new Set(changes.map((c) => c.toothNumber));
  const unrecordedCount = past.filter((p) => p.unrecorded).length;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5" disabled={days.length === 0}>
          <GitCompareArrows className="size-4" /> Compare
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Compare chart over time</DialogTitle>
          <DialogDescription>
            Rebuilt from the recorded status history. Nothing here changes the patient&apos;s record.
          </DialogDescription>
        </DialogHeader>

        {before === null ? (
          <p className="text-muted-foreground text-sm">No status changes have been recorded for this patient yet.</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted-foreground text-sm">Before</span>
              <Select value={before.toISOString()} onValueChange={setBeforeKey}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d.toISOString()} value={d.toISOString()}>
                      End of {formatDate(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ArrowRight className="text-muted-foreground size-4" />
              <span className="text-sm font-medium">Current chart</span>
              <label className="text-muted-foreground ml-auto flex items-center gap-2 text-sm">
                <Switch checked={changesOnly} onCheckedChange={setChangesOnly} />
                Highlight changed teeth
              </label>
            </div>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">As recorded at the end of {formatDate(before)}</h3>
              <InteractiveOdontogram
                teeth={past.map((p) => p.tooth)}
                selectedToothNumber={selected}
                onSelect={onSelect}
                focus={null}
                highlight={changesOnly ? changed : null}
                idPrefix={idPrefix}
              />
              {unrecordedCount > 0 && (
                <p className="text-muted-foreground text-xs">
                  {unrecordedCount} {unrecordedCount === 1 ? "tooth had" : "teeth had"} no status recorded by this date and{" "}
                  {unrecordedCount === 1 ? "is" : "are"} shown with the record&apos;s default (Normal).
                </p>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Current chart</h3>
              <InteractiveOdontogram
                teeth={teeth}
                selectedToothNumber={selected}
                onSelect={onSelect}
                focus={null}
                highlight={changesOnly ? changed : null}
                idPrefix={idPrefix}
              />
            </section>

            <section className="rounded-xl border">
              <h3 className="border-b px-4 py-2.5 text-sm font-semibold">
                {changes.length} {changes.length === 1 ? "tooth" : "teeth"} changed since {formatDate(before)}
              </h3>
              {changes.length === 0 ? (
                <p className="text-muted-foreground px-4 py-3 text-sm">No recorded status changes in this period.</p>
              ) : (
                <ul className="divide-y">
                  {changes.map((c) => (
                    <li key={c.toothNumber} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                      <span className="w-52 font-medium">
                        #{c.toothNumber} <span className="text-muted-foreground font-normal">{toothName(c.toothNumber)}</span>
                      </span>
                      <StatusPill condition={c.from} />
                      <ArrowRight className="text-muted-foreground size-3.5" />
                      <StatusPill condition={c.to} />
                      <span className="text-muted-foreground ml-auto text-xs">
                        {c.unrecorded ? "First recorded" : `${CONDITION_META[c.from].label} → ${CONDITION_META[c.to].label}`}
                        {c.at ? ` · ${formatDate(c.at)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
