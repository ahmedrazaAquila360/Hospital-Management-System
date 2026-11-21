"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  CONDITION_META,
  LOWER_LEFT,
  LOWER_RIGHT,
  UPPER_LEFT,
  UPPER_RIGHT,
  parseSurfaces,
  toothName,
  type ToothConditionKey,
} from "@/lib/dental";
import { ToothGraphic, isUpperTooth } from "@/components/dental-chart/tooth-graphic";
import { cn } from "@/lib/utils";
import type { getDentalChartForPatient } from "@/server/dental-chart/queries";

type Patient = NonNullable<Awaited<ReturnType<typeof getDentalChartForPatient>>>;
type Tooth = NonNullable<Patient["dentalRecord"]>["teeth"][number];

function ToothButton({
  tooth,
  toothNumber,
  isSelected,
  dimmed,
  idPrefix,
  onClick,
  tabbable,
  onKeyDown,
  onFocus,
  register,
}: {
  tooth?: Tooth;
  toothNumber: number;
  isSelected: boolean;
  dimmed: boolean;
  idPrefix: string;
  onClick: () => void;
  /** Roving tab stop: only one tooth in the chart is in the tab order. */
  tabbable: boolean;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  onFocus: () => void;
  register: (el: HTMLButtonElement | null) => void;
}) {
  const upper = isUpperTooth(toothNumber);
  const number = (
    <span
      className={cn(
        "text-foreground/85 text-sm font-semibold tabular-nums transition-colors",
        isSelected && "text-primary",
        dimmed && "opacity-35"
      )}
    >
      {toothNumber}
    </span>
  );

  if (!tooth) {
    return (
      <div className={cn("flex w-full flex-col items-center gap-2.5", !upper && "flex-col-reverse")}>
        {number}
        <div className="aspect-40/78 w-full" />
      </div>
    );
  }

  const entry = tooth.conditions.find((c) => c.condition === tooth.currentCondition);

  return (
    <button
      ref={register}
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      tabIndex={tabbable ? 0 : -1}
      title={`Tooth ${tooth.toothNumber} · ${toothName(tooth.toothNumber)} · ${CONDITION_META[tooth.currentCondition].label}`}
      aria-label={`Tooth ${tooth.toothNumber}, ${toothName(tooth.toothNumber)}, ${CONDITION_META[tooth.currentCondition].label}`}
      aria-pressed={isSelected}
      className={cn(
        "group flex w-full flex-col items-center gap-2.5 rounded-xl outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        !upper && "flex-col-reverse"
      )}
    >
      {number}
      <span
        className={cn(
          "flex aspect-40/78 w-full items-center justify-center rounded-xl border-2 border-transparent px-px py-1 transition-all duration-200",
          "group-hover:bg-primary/5 group-hover:border-primary/25",
          isSelected &&
            "border-primary bg-primary/8 group-hover:border-primary group-hover:bg-primary/8 shadow-[0_0_0_4px_color-mix(in_oklab,var(--primary)_12%,transparent)]",
          dimmed && "opacity-25 saturate-50"
        )}
      >
        <ToothGraphic
          toothNumber={tooth.toothNumber}
          condition={tooth.currentCondition}
          surfaces={parseSurfaces(entry?.surface)}
          idPrefix={idPrefix}
          className="h-full w-full drop-shadow-[0_2px_2px_rgb(80_60_30/0.14)] transition-transform duration-200 group-hover:scale-[1.04]"
        />
      </span>
    </button>
  );
}

const UPPER_ROW = [...UPPER_RIGHT, ...UPPER_LEFT];
const LOWER_ROW = [...[...LOWER_RIGHT].reverse(), ...LOWER_LEFT];

function QuadrantCaptions({ upper }: { upper: boolean }) {
  return (
    <div className="text-muted-foreground flex justify-between text-[11px] font-medium tracking-wide uppercase">
      <span>
        Q{upper ? 1 : 4} · Patient&apos;s right
      </span>
      <span>
        Q{upper ? 2 : 3} · Patient&apos;s left
      </span>
    </div>
  );
}

/**
 * Upper/lower buccal-view chart (FDI, viewed facing the patient). Selection and tooth
 * data are owned by the parent (DentalChartViews), which shows the selected tooth's
 * side panel — the same selection the 3D view uses.
 *
 * Keyboard: one tooth is in the tab order; arrow keys move along and across the
 * arches (Up/Down jump to the opposing tooth), Home/End go to the arch ends, and
 * Enter/Space select.
 */
export function InteractiveOdontogram({
  teeth,
  selectedToothNumber,
  onSelect,
  focus,
  highlight = null,
  idPrefix,
}: {
  teeth: Tooth[];
  selectedToothNumber: number | null;
  onSelect: (toothNumber: number) => void;
  /** Status highlighted in the legend; other teeth fade. */
  focus: ToothConditionKey | null;
  /** Teeth to keep at full strength (e.g. changed teeth in a comparison); others fade. */
  highlight?: Set<number> | null;
  /** Prefix of a <ToothGraphicDefs> rendered by the parent. */
  idPrefix: string;
}) {
  const byNumber = new Map(teeth.map((t) => [t.toothNumber, t]));
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [active, setActive] = useState<number | null>(null);
  const tabStop = active ?? selectedToothNumber ?? UPPER_ROW.find((n) => byNumber.has(n)) ?? null;

  function move(from: number, key: string) {
    const upper = UPPER_ROW.includes(from);
    const row = upper ? UPPER_ROW : LOWER_ROW;
    const other = upper ? LOWER_ROW : UPPER_ROW;
    const i = row.indexOf(from);
    const step = (list: number[], start: number, dir: 1 | -1) => {
      for (let j = start; j >= 0 && j < list.length; j += dir) if (byNumber.has(list[j])) return list[j];
      return null;
    };
    switch (key) {
      case "ArrowRight":
        return step(row, i + 1, 1);
      case "ArrowLeft":
        return step(row, i - 1, -1);
      case "ArrowUp":
      case "ArrowDown":
        // Same screen column in the opposing arch.
        return (key === "ArrowUp") === upper ? null : step(other, i, 1) ?? step(other, i, -1);
      case "Home":
        return step(row, 0, 1);
      case "End":
        return step(row, row.length - 1, -1);
    }
    return null;
  }

  function handleKey(n: number, e: KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = move(n, e.key);
    if (next !== null) {
      setActive(next);
      buttons.current.get(next)?.focus();
    }
  }

  const row = (numbers: number[]) =>
    numbers.map((n, i) => (
      <div
        key={n}
        className={cn(
          "flex max-w-17 min-w-10 flex-1 justify-center",
          i === 8 && "border-primary/25 ml-1 border-l-2 border-dashed pl-1"
        )}
      >
        <ToothButton
          tooth={byNumber.get(n)}
          toothNumber={n}
          isSelected={selectedToothNumber === n}
          dimmed={(focus !== null && byNumber.get(n)?.currentCondition !== focus) || (highlight !== null && !highlight.has(n))}
          idPrefix={idPrefix}
          onClick={() => byNumber.has(n) && onSelect(n)}
          tabbable={tabStop === n}
          onKeyDown={(e) => handleKey(n, e)}
          onFocus={() => setActive(n)}
          register={(el) => {
            if (el) buttons.current.set(n, el);
            else buttons.current.delete(n);
          }}
        />
      </div>
    ));

  return (
    <div
      role="group"
      aria-label="Dental chart, FDI numbering. Use arrow keys to move between teeth."
      className="bg-card overflow-x-auto rounded-xl border shadow-xs"
    >
      <div className="flex min-w-180 flex-col">
        <section className="flex flex-col gap-3 px-4 pt-4 pb-6 sm:px-5">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight">Upper</h3>
            <span className="text-muted-foreground text-xs">Maxillary arch · viewed facing the patient</span>
          </div>
          <QuadrantCaptions upper />
          <div className="flex justify-between gap-0.5 sm:gap-1">{row(UPPER_ROW)}</div>
        </section>
        <section className="flex flex-col gap-3 border-t px-4 pt-6 pb-4 sm:px-5">
          <div className="flex justify-between gap-0.5 sm:gap-1">{row(LOWER_ROW)}</div>
          <QuadrantCaptions upper={false} />
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-lg font-semibold tracking-tight">Lower</h3>
            <span className="text-muted-foreground text-xs">Mandibular arch</span>
          </div>
        </section>
      </div>
    </div>
  );
}
