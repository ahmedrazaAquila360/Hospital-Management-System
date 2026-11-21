"use client";

import { CONDITION_META, TOOTH_CONDITIONS, type ToothConditionKey } from "@/lib/dental";
import { cn } from "@/lib/utils";

/** Status dot shared by the legend, tooth pills and timelines: hollow for Healthy/Missing. */
export function ConditionDot({ condition, className }: { condition: ToothConditionKey; className?: string }) {
  const hollow = condition === "HEALTHY" || condition === "MISSING";
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full border", className)}
      style={{
        // Glossy swatch: highlight top-left, full colour towards the edge.
        background: hollow
          ? "var(--background)"
          : `radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.65) 0 12%, ${CONDITION_META[condition].color} 55%)`,
        borderColor: hollow
          ? "color-mix(in oklab, var(--muted-foreground) 70%, transparent)"
          : `color-mix(in oklab, ${CONDITION_META[condition].color} 70%, black)`,
        borderStyle: condition === "MISSING" ? "dashed" : "solid",
      }}
    />
  );
}

/**
 * Compact clinical legend for the dental chart. Both the 2D and 3D views render it
 * in their side column; pass `onToggle` to make rows act as a highlight filter.
 */
export function ConditionLegend({
  counts,
  active = null,
  onToggle,
  footer,
  renderIcon,
  layout = "sidebar",
}: {
  counts: Map<ToothConditionKey, number>;
  active?: ToothConditionKey | null;
  onToggle?: (condition: ToothConditionKey | null) => void;
  footer?: string;
  /** Optional per-condition illustration (the 2D view shows its mini tooth). */
  renderIcon?: (condition: ToothConditionKey) => React.ReactNode;
  /**
   * `sidebar` beside the 3D model; `bar` spans the width; `strip` is the single-row key
   * above the 2D chart; `rail` is the compact vertical key floating inside the 3D viewport.
   */
  layout?: "sidebar" | "bar" | "strip" | "rail";
}) {
  const bar = layout === "bar";

  if (layout === "rail") {
    const shown = TOOTH_CONDITIONS.filter((c) => c !== "FRACTURE" || (counts.get(c) ?? 0) > 0);
    return (
      <div role="group" aria-label="Status legend" className="bg-background/90 flex flex-col rounded-xl border p-1 shadow-sm backdrop-blur">
        {shown.map((c) => {
          const count = counts.get(c) ?? 0;
          const isActive = active === c;
          return (
            <button
              key={c}
              type="button"
              disabled={!onToggle || count === 0}
              aria-pressed={isActive}
              title={count > 0 ? `${count} ${count === 1 ? "tooth" : "teeth"} — click to highlight` : "None on this chart"}
              onClick={() => onToggle?.(isActive ? null : c)}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors",
                "hover:bg-muted/70 disabled:cursor-default disabled:hover:bg-transparent",
                count === 0 && "text-muted-foreground",
                isActive && "bg-primary/10 text-primary font-medium"
              )}
            >
              <ConditionDot condition={c} className="size-3" />
              <span className="flex-1">{CONDITION_META[c].label}</span>
              {count > 0 && <span className="text-muted-foreground tabular-nums">{count}</span>}
            </button>
          );
        })}
        {active && onToggle && (
          <button type="button" onClick={() => onToggle(null)} className="text-primary px-2 py-1 text-left text-xs font-medium hover:underline">
            Show all
          </button>
        )}
      </div>
    );
  }

  if (layout === "strip") {
    // Fracture isn't part of the standard key; only list it when a tooth has it.
    const shown = TOOTH_CONDITIONS.filter((c) => c !== "FRACTURE" || (counts.get(c) ?? 0) > 0);
    return (
      <div
        role="group"
        aria-label="Status legend"
        className="bg-card flex flex-wrap items-center gap-y-1 rounded-xl border px-1.5 py-1.5 shadow-xs"
      >
        {shown.map((c) => {
          const count = counts.get(c) ?? 0;
          const isActive = active === c;
          return (
            <button
              key={c}
              type="button"
              disabled={!onToggle || count === 0}
              aria-pressed={isActive}
              title={count > 0 ? `${count} ${count === 1 ? "tooth" : "teeth"} — click to highlight` : "None on this chart"}
              onClick={() => onToggle?.(isActive ? null : c)}
              className={cn(
                "flex items-center gap-1.5 border-l px-2 py-1.5 text-[13px] transition-colors first:border-l-0",
                "hover:bg-muted/60 rounded-md disabled:cursor-default disabled:hover:bg-transparent",
                isActive && "bg-primary/8 text-primary rounded-md font-medium"
              )}
            >
              <ConditionDot condition={c} className="size-3.5" />
              {CONDITION_META[c].label}
            </button>
          );
        })}
        {active && onToggle && (
          <button type="button" onClick={() => onToggle(null)} className="text-primary ml-auto px-3 text-xs font-medium hover:underline">
            Show all
          </button>
        )}
      </div>
    );
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const healthy = counts.get("HEALTHY") ?? 0;
  const missing = counts.get("MISSING") ?? 0;
  const affected = total - healthy - missing;

  return (
    <section className="bg-card rounded-xl border shadow-xs">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-3">
        <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Status legend</h3>
        <div className="flex items-center gap-3">
          {bar && footer && <p className="text-muted-foreground hidden text-xs md:block">{footer}</p>}
          {active && onToggle && (
            <button type="button" onClick={() => onToggle(null)} className="text-primary text-xs font-medium hover:underline">
              Show all
            </button>
          )}
        </div>
      </header>

      <div className={cn("grid grid-cols-3 divide-x border-b text-center", bar && "hidden")}>
        {[
          { label: "Affected", value: affected, className: "text-primary" },
          { label: "Healthy", value: healthy, className: "text-success" },
          { label: "Missing", value: missing, className: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="px-2 py-2.5">
            <div className={cn("text-lg leading-none font-semibold tabular-nums", s.className)}>{s.value}</div>
            <div className="text-muted-foreground mt-1 text-[11px]">{s.label}</div>
          </div>
        ))}
      </div>

      <ul
        className={cn(
          "grid gap-x-2 gap-y-0.5 p-2",
          bar ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6" : "grid-cols-2"
        )}
      >
        {TOOTH_CONDITIONS.map((c) => {
          const count = counts.get(c) ?? 0;
          const isActive = active === c;
          const content = (
            <>
              <ConditionDot condition={c} />
              {renderIcon?.(c)}
              <span className="flex-1 truncate text-left">{CONDITION_META[c].label}</span>
              <span className={cn("text-xs tabular-nums", count === 0 ? "text-muted-foreground/60" : "text-muted-foreground font-medium")}>
                {count}
              </span>
            </>
          );
          const rowClass = cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm",
            count === 0 && "text-muted-foreground/70",
            isActive && "bg-primary/8 text-foreground ring-primary/30 ring-1"
          );
          return (
            <li key={c}>
              {onToggle ? (
                <button
                  type="button"
                  disabled={count === 0}
                  aria-pressed={isActive}
                  onClick={() => onToggle(isActive ? null : c)}
                  className={cn(rowClass, "hover:bg-muted/70 transition-colors disabled:pointer-events-none")}
                >
                  {content}
                </button>
              ) : (
                <div className={rowClass}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>

      {footer && <p className={cn("text-muted-foreground border-t px-4 py-2.5 text-xs", bar && "md:hidden")}>{footer}</p>}
    </section>
  );
}
