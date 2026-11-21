"use client";

import type { ReactNode } from "react";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Recessive axis text shared by every dashboard chart. */
export const AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 };
export const GRID_STROKE = "#e6eef6";

type TooltipEntry = { name?: string | number; value?: unknown; color?: string; dataKey?: string | number };

/** Tooltip card used by the dashboard charts; values in text ink, identity from the swatch. */
export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = (v) => String(v),
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: ReactNode;
  formatValue?: (value: number, entry: TooltipEntry) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-xl border border-border bg-white/95 px-3 py-2.5 text-xs shadow-elevated backdrop-blur">
      {label !== undefined && <p className="text-navy mb-1.5 font-semibold">{label}</p>}
      <ul className="space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey ?? entry.name)} className="flex items-center justify-between gap-4">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: entry.color }} />
              {entry.name}
            </span>
            <span className="text-foreground font-semibold tabular">{formatValue(Number(entry.value), entry)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <span className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

export function ChartHeader({
  title,
  description,
  aside,
}: {
  title: string;
  description?: string;
  aside?: ReactNode;
}) {
  return (
    <CardHeader className="flex flex-wrap items-start justify-between gap-2">
      <div className="space-y-0.5">
        <CardTitle className="text-[15px]">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </div>
      {aside}
    </CardHeader>
  );
}
