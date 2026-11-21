"use client";

import type { Dispatch, SetStateAction } from "react";
import { RotateCcw } from "lucide-react";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import {
  LOWER_LEFT,
  LOWER_LEFT_PRIMARY,
  LOWER_RIGHT,
  LOWER_RIGHT_PRIMARY,
  UPPER_LEFT,
  UPPER_LEFT_PRIMARY,
  UPPER_RIGHT,
  UPPER_RIGHT_PRIMARY,
  isPrimaryTooth,
} from "@/lib/dental";
import { cn } from "@/lib/utils";

export type Dentition = "adult" | "child";

// As seen facing the patient: upper right → upper left, lower right → lower left.
const LAYOUT: Record<Dentition, { upper: number[]; lower: number[] }> = {
  adult: { upper: [...UPPER_RIGHT, ...UPPER_LEFT], lower: [...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT] },
  child: { upper: [...UPPER_RIGHT_PRIMARY, ...UPPER_LEFT_PRIMARY], lower: [...[...LOWER_RIGHT_PRIMARY].reverse(), ...LOWER_LEFT_PRIMARY] },
};
const ORDER = [...LAYOUT.adult.upper, ...LAYOUT.adult.lower, ...LAYOUT.child.upper, ...LAYOUT.child.lower];

/** Starts in Child mode only when every preselected tooth is a primary tooth. */
export function initialDentition(teeth: number[]): Dentition {
  return teeth.length > 0 && teeth.every(isPrimaryTooth) ? "child" : "adult";
}

/** Adult (Permanent) / Child (Primary) switch shown in the section header. */
export function DentitionToggle({ value, onChange }: { value: Dentition; onChange: (next: Dentition) => void }) {
  return (
    <div className="bg-muted/70 inline-flex rounded-full p-1" role="group" aria-label="Dentition">
      {(
        [
          ["adult", "Adult (Permanent)"],
          ["child", "Child (Primary)"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "h-8 rounded-full px-3.5 text-xs font-semibold whitespace-nowrap transition-colors sm:text-sm",
            value === v ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * FDI tooth picker. Adult mode shows permanent teeth (11–48), Child mode primary teeth
 * (51–85); a mixed-dentition selection is kept when switching. Submitted as repeated
 * `teeth` inputs; the selection is controlled by the parent.
 */
export function ToothSelector({
  selected,
  onChange,
  mode,
}: {
  selected: number[];
  onChange: Dispatch<SetStateAction<number[]>>;
  mode: Dentition;
}) {
  const set = new Set(selected);
  const sorted = ORDER.filter((n) => set.has(n));
  const otherCount = sorted.filter((n) => isPrimaryTooth(n) !== (mode === "child")).length;
  const cols = mode === "adult" ? "grid-cols-16 min-w-[30rem]" : "grid-cols-10 min-w-[19rem] max-w-xl";

  function toggle(n: number) {
    // Functional update, so quick successive clicks never work from a stale selection.
    onChange((prev) => (prev.includes(n) ? prev.filter((t) => t !== n) : [...prev, n]));
  }

  return (
    <div className="flex flex-col gap-4">
      {sorted.map((n) => (
        <input key={n} type="hidden" name="teeth" value={n} />
      ))}
      {[
        { label: "Upper (Maxillary)", teeth: LAYOUT[mode].upper },
        { label: "Lower (Mandibular)", teeth: LAYOUT[mode].lower },
      ].map((arch) => (
        <div key={arch.label}>
          <p className="text-navy mb-2 text-sm font-semibold">{arch.label}</p>
          <div className="no-scrollbar -mx-1 overflow-x-auto px-1 pb-1">
            <div className={cn("grid gap-1.5", cols)} role="group" aria-label={`${arch.label}, ${mode === "adult" ? "permanent" : "primary"} teeth`}>
              {arch.teeth.map((n, i) => {
                const on = set.has(n);
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    aria-pressed={on}
                    aria-label={`Tooth ${n}`}
                    className={cn(
                      "flex h-9 items-center justify-center rounded-lg border text-xs font-semibold tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                      i === arch.teeth.length / 2 && "ml-1.5",
                      on ? "bg-brand border-brand text-white shadow-sm" : "border-border/80 text-foreground/80 hover:border-brand/50 hover:bg-pale bg-white"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      <div className="bg-pale/60 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl px-3 py-2.5 text-sm">
        <span className="text-navy inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold shadow-xs">
          <ToothIcon className="text-brand size-4" />
          Selected: {sorted.length} {sorted.length === 1 ? "tooth" : "teeth"}
        </span>
        <span className="text-foreground/80 min-w-0 flex-1 tabular-nums">
          {sorted.length ? sorted.join(", ") : "No teeth selected (optional)"}
          {otherCount > 0 && (
            <span className="text-muted-foreground block text-xs">
              Includes {otherCount} {mode === "adult" ? "primary" : "permanent"} {otherCount === 1 ? "tooth" : "teeth"} — switch to {mode === "adult" ? "Child" : "Adult"} to see {otherCount === 1 ? "it" : "them"}.
            </span>
          )}
        </span>
        {sorted.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="text-brand inline-flex items-center gap-1.5 text-sm font-semibold hover:underline">
            <RotateCcw className="size-3.5" aria-hidden /> Clear Selection
          </button>
        )}
      </div>
    </div>
  );
}
