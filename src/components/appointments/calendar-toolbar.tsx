"use client";

import { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPOINTMENT_STATUSES } from "@/lib/validations/appointment";
import { APPOINTMENT_STATUS_LABEL } from "@/lib/labels";
import { navigateDate, parseDateParam, rangeLabel, toDateParam, type CalendarView } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

/**
 * Calendar controls. Everything lives in the URL: date/view changes push history entries
 * (Back works), filters and search replace. Selects read their value from the URL so they
 * stay in sync with Back/Forward (they used uncontrolled defaultValue before).
 */
export function CalendarToolbar({
  view,
  dateParam,
  dentists,
  count,
}: {
  view: CalendarView;
  /** YYYY-MM-DD; parsed here so labels and navigation use the browser's own calendar day. */
  dateParam: string;
  dentists: { id: string; name: string }[];
  count: number;
}) {
  const date = parseDateParam(dateParam);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(next: Record<string, string | undefined>, mode: "push" | "replace" = "push") {
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const href = `${pathname}?${params.toString()}`;
    startTransition(() => (mode === "push" ? router.push(href, { scroll: false }) : router.replace(href, { scroll: false })));
  }

  function onSearch(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => go({ q: value.trim() || undefined }, "replace"), 300);
  }

  const dentistId = searchParams.get("dentistId") ?? "all";
  const status = searchParams.get("status") ?? "all";

  return (
    <div className="surface-card flex flex-col gap-3 p-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <div className="border-border bg-card flex items-center rounded-xl border p-0.5 shadow-xs">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label={`Previous ${view}`}
            onClick={() => go({ date: toDateParam(navigateDate(view, date, -1)) })}
          >
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg px-3 font-semibold" onClick={() => go({ date: toDateParam(new Date()) })}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-lg"
            aria-label={`Next ${view}`}
            onClick={() => go({ date: toDateParam(navigateDate(view, date, 1)) })}
          >
            <ChevronRight />
          </Button>
        </div>
        <h2 className="text-navy flex items-center gap-2 text-lg font-semibold tracking-tight" aria-live="polite">
          <CalendarDays className="text-brand size-5" aria-hidden />
          {rangeLabel(view, date)}
          {isPending && <Loader2 className="text-brand size-4 animate-spin" aria-label="Loading" />}
        </h2>
        <span className="bg-pale text-navy rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
          {count} appointment{count === 1 ? "" : "s"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-muted/70 flex rounded-xl p-1" role="group" aria-label="Calendar view">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              type="button"
              aria-pressed={view === v.value}
              onClick={() => view !== v.value && go({ view: v.value })}
              className={cn(
                "h-8 cursor-pointer rounded-lg px-3.5 text-sm font-medium transition-colors",
                view === v.value ? "bg-card text-brand shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-44">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden />
          <Input
            type="search"
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search…"
            aria-label="Search appointments"
            className="h-10 pr-8 pl-9 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => onSearch("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Select value={dentistId} onValueChange={(v) => go({ dentistId: v === "all" ? undefined : v }, "replace")}>
          <SelectTrigger className="h-10! w-[calc(50%-0.25rem)] sm:w-40" aria-label="Filter by dentist">
            <SelectValue placeholder="Dentist" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dentists</SelectItem>
            {dentists.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={(v) => go({ status: v === "all" ? undefined : v }, "replace")}>
          <SelectTrigger className="h-10! w-[calc(50%-0.25rem)] sm:w-36" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {APPOINTMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPOINTMENT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
