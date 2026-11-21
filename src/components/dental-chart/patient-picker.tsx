"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp, LayoutGrid, List, ListFilter, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Client side of the dental-chart patient workspace (the list itself is rendered on the
 * server from `listPatients`). Every control writes to the URL, so search, filters, sort,
 * page and layout survive reloads and back/forward, and the server re-renders the list.
 */

type WorkspaceNav = {
  query: string;
  onQueryChange: (value: string) => void;
  update: (mutate: (params: URLSearchParams) => void) => void;
  clearAll: () => void;
  isPending: boolean;
};

const WorkspaceNavContext = createContext<WorkspaceNav | null>(null);

function useWorkspaceNav() {
  const ctx = useContext(WorkspaceNavContext);
  if (!ctx) throw new Error("useWorkspaceNav must be used inside <PatientWorkspaceProvider>");
  return ctx;
}

export function PatientWorkspaceProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const urlSearch = searchParams.get("search") ?? "";
  const [query, setQuery] = useState(urlSearch);
  // The URL value last reconciled with the input, and the one we last navigated to:
  // back/forward updates the input, our own debounced navigation never overwrites
  // something the user typed after it.
  const [seenUrlSearch, setSeenUrlSearch] = useState(urlSearch);
  const [pushedSearch, setPushedSearch] = useState(urlSearch);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (urlSearch !== seenUrlSearch) {
    setSeenUrlSearch(urlSearch);
    if (urlSearch !== pushedSearch) {
      setQuery(urlSearch);
      setPushedSearch(urlSearch);
    }
  }

  function navigate(params: URLSearchParams) {
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function update(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(window.location.search);
    mutate(params);
    navigate(params);
  }

  function applySearch(value: string) {
    const term = value.trim();
    setPushedSearch(term);
    update((p) => {
      if (term) p.set("search", term);
      else p.delete("search");
      p.delete("page");
    });
  }

  return (
    <WorkspaceNavContext.Provider
      value={{
        query,
        isPending,
        update,
        onQueryChange(value) {
          setQuery(value);
          if (debounce.current) clearTimeout(debounce.current);
          debounce.current = setTimeout(() => applySearch(value), 300);
        },
        clearAll() {
          if (debounce.current) clearTimeout(debounce.current);
          setQuery("");
          setPushedSearch("");
          update((p) => {
            for (const key of ["search", "gender", "dentistId", "page"]) p.delete(key);
          });
        },
      }}
    >
      {children}
    </WorkspaceNavContext.Provider>
  );
}

/** The hero search field. "/" focuses it from anywhere on the page; Esc clears it. */
export function PatientSearchField() {
  const { query, onQueryChange, isPending } = useWorkspaceNav();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative">
      <Search className="text-brand pointer-events-none absolute top-1/2 left-4 z-10 size-[1.1rem] -translate-y-1/2" aria-hidden />
      <Input
        ref={inputRef}
        type="search"
        autoFocus
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && query) {
            e.preventDefault();
            onQueryChange("");
          }
        }}
        placeholder="Name, patient ID or phone…"
        aria-label="Search patients"
        autoComplete="off"
        className="text-foreground h-13 rounded-2xl border-white/30 bg-white pr-12 pl-11 text-sm shadow-[0_18px_40px_-18px_rgb(2_20_45/0.7)] sm:pr-24 sm:text-[0.95rem] [&::-webkit-search-cancel-button]:hidden"
      />
      <div className="absolute inset-y-0 right-3 flex items-center gap-2">
        {isPending && <Loader2 className="text-brand size-4 animate-spin" aria-label="Searching" />}
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex size-7 cursor-pointer items-center justify-center rounded-lg transition-colors"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        ) : (
          <Kbd className="hidden sm:inline-flex" aria-hidden>
            /
          </Kbd>
        )}
      </div>
    </div>
  );
}

const SORT_OPTIONS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "recent", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
];
const GENDER_OPTIONS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

/** Filter popover (gender, dentist), sort, and list/grid layout for the patients card. */
export function PatientListControls({
  sort,
  gender,
  dentistId,
  layout,
  dentists,
}: {
  sort: string;
  gender?: string;
  dentistId?: string;
  layout: "list" | "grid";
  dentists: { id: string; name: string }[];
}) {
  const { update } = useWorkspaceNav();
  const activeFilters = Number(Boolean(gender)) + Number(Boolean(dentistId));

  function setParam(key: string, value: string | null, resetPage = true) {
    update((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      if (resetPage) p.delete("page");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="relative">
            <ListFilter /> Filter
            {activeFilters > 0 && (
              <span className="bg-primary text-primary-foreground flex size-4.5 items-center justify-center rounded-full text-[10px] font-semibold">
                {activeFilters}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-4 p-4">
          <div className="flex items-center justify-between">
            <p className="text-navy text-sm font-semibold">Filter patients</p>
            {activeFilters > 0 && (
              <button
                type="button"
                className="text-brand cursor-pointer text-xs font-medium hover:underline"
                onClick={() =>
                  update((p) => {
                    p.delete("gender");
                    p.delete("dentistId");
                    p.delete("page");
                  })
                }
              >
                Clear filters
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="chart-filter-gender" className="text-muted-foreground text-xs font-medium">
              Gender
            </label>
            <Select value={gender ?? "all"} onValueChange={(v) => setParam("gender", v === "all" ? null : v)}>
              <SelectTrigger id="chart-filter-gender" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All genders</SelectItem>
                {GENDER_OPTIONS.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="chart-filter-dentist" className="text-muted-foreground text-xs font-medium">
              Dentist
            </label>
            <Select value={dentistId ?? "all"} onValueChange={(v) => setParam("dentistId", v === "all" ? null : v)}>
              <SelectTrigger id="chart-filter-dentist" className="w-full">
                <SelectValue />
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
            <p className="text-muted-foreground text-[11px]">Patients with an appointment or treatment by this dentist.</p>
          </div>
        </PopoverContent>
      </Popover>

      <Select value={sort} onValueChange={(v) => setParam("sort", v === "name_asc" ? null : v)}>
        <SelectTrigger className="w-auto min-w-44" aria-label="Sort patients">
          <ArrowDownUp className="text-muted-foreground" />
          <span className="text-muted-foreground">Sort:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {SORT_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Both layouts are a single column on phones, so the toggle only appears from sm up. */}
      <div className="bg-muted/70 hidden rounded-xl p-1 sm:flex" role="group" aria-label="Layout">
        {(
          [
            { value: "list", icon: List, label: "List view" },
            { value: "grid", icon: LayoutGrid, label: "Grid view" },
          ] as const
        ).map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            aria-pressed={layout === value}
            onClick={() => setParam("layout", value === "list" ? null : value, false)}
            className={cn(
              "flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors",
              layout === value
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/80"
            )}
          >
            <Icon className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** Dims the list while a search/filter navigation is in flight. */
export function PendingRegion({ children, className }: { children: ReactNode; className?: string }) {
  const { isPending } = useWorkspaceNav();
  return (
    <div aria-busy={isPending} className={cn("transition-opacity duration-200", isPending && "opacity-55", className)}>
      {children}
    </div>
  );
}

export function ClearSearchButton() {
  const { clearAll } = useWorkspaceNav();
  return (
    <Button variant="outline" onClick={clearAll}>
      <X /> Clear search and filters
    </Button>
  );
}
