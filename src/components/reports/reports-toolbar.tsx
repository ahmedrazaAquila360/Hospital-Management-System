"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReportRange } from "@/lib/reports";
import { cn } from "@/lib/utils";

const RANGES: { value: ReportRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

/**
 * Period picker. Preset ranges apply at once; a custom range applies with the button, after
 * checking both dates are set and in order. (The date boxes used to navigate on every
 * keystroke, adding a history entry each time, and a half-filled range silently showed today.)
 */
export function ReportsToolbar({ range, from, to }: { range: ReportRange; from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [showCustom, setShowCustom] = useState(range === "custom");
  const [draftFrom, setDraftFrom] = useState(from ?? "");
  const [draftTo, setDraftTo] = useState(to ?? "");
  const [error, setError] = useState<string | null>(null);

  function go(params: Record<string, string>) {
    startTransition(() => router.push(`${pathname}?${new URLSearchParams(params).toString()}`, { scroll: false }));
  }

  function applyCustom() {
    if (!draftFrom || !draftTo) return setError("Choose both a start and an end date.");
    if (draftFrom > draftTo) return setError("The start date must be on or before the end date.");
    setError(null);
    go({ range: "custom", from: draftFrom, to: draftTo });
  }

  return (
    <div className="surface-card flex flex-col gap-3 p-3 sm:p-4 print:hidden">
      <div className="flex flex-wrap items-center gap-3">
        <div className="bg-muted/70 flex max-w-full overflow-x-auto rounded-xl p-1" role="group" aria-label="Report period">
          {RANGES.map((r) => {
            const active = r.value === "custom" ? showCustom : !showCustom && range === r.value;
            return (
              <button
                key={r.value}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  if (r.value === "custom") return setShowCustom(true);
                  setShowCustom(false);
                  setError(null);
                  go({ range: r.value });
                }}
                className={cn(
                  "h-9 cursor-pointer rounded-lg px-3.5 text-sm font-medium whitespace-nowrap transition-colors",
                  active ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
        {isPending && <Loader2 className="text-brand size-4 animate-spin" aria-label="Loading report" />}
      </div>

      {showCustom && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-medium">
              From
              <span className="relative">
                <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                <Input type="date" value={draftFrom} max={draftTo || undefined} onChange={(e) => setDraftFrom(e.target.value)} className="h-10 w-44 pl-9" />
              </span>
            </label>
            <label className="grid gap-1 text-xs font-medium">
              To
              <span className="relative">
                <CalendarDays className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
                <Input type="date" value={draftTo} min={draftFrom || undefined} onChange={(e) => setDraftTo(e.target.value)} className="h-10 w-44 pl-9" />
              </span>
            </label>
            <Button onClick={applyCustom} disabled={isPending} className="h-10">
              <Check /> Apply
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-destructive text-xs font-medium">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
