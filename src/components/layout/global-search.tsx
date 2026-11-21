"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, User, CalendarDays, Receipt, Stethoscope } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import type { SearchResult } from "@/app/api/search/route";

const TYPE_ICON: Record<SearchResult["type"], typeof User> = {
  patient: User,
  appointment: CalendarDays,
  invoice: Receipt,
  treatment: Stethoscope,
};

const TYPE_LABEL: Record<SearchResult["type"], string> = {
  patient: "Patients",
  appointment: "Appointments",
  invoice: "Invoices",
  treatment: "Treatments",
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["global-search", query],
    queryFn: async (): Promise<{ results: SearchResult[] }> => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: open && query.trim().length >= 2,
  });

  const grouped = (data?.results ?? []).reduce<Record<string, SearchResult[]>>((acc, r) => {
    (acc[r.type] ??= []).push(r);
    return acc;
  }, {});

  function select(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  return (
    <>
      <Button
        variant="outline"
        className="text-muted-foreground hover:text-muted-foreground hidden h-10 w-64 justify-start gap-2.5 rounded-xl bg-background px-3.5 font-normal shadow-none sm:flex lg:w-80"
        onClick={() => setOpen(true)}
      >
        <Search className="text-brand size-4" />
        <span className="flex-1 truncate text-left">Search patients, appointments…</span>
        <Kbd className="bg-card ring-1 ring-border">⌘K</Kbd>
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Search"
        className="text-muted-foreground size-10 rounded-xl sm:hidden"
        onClick={() => setOpen(true)}
      >
        <Search className="size-4.5" />
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search patients, appointments, invoices, treatments…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {query.trim().length < 2 && (
              <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
            )}
            {query.trim().length >= 2 && !isFetching && (data?.results.length ?? 0) === 0 && (
              <CommandEmpty>No results found.</CommandEmpty>
            )}
            {(Object.keys(grouped) as SearchResult["type"][]).map((type) => {
              const Icon = TYPE_ICON[type];
              return (
                <CommandGroup key={type} heading={TYPE_LABEL[type]}>
                  {grouped[type].map((r) => (
                    <CommandItem key={`${r.type}-${r.id}`} onSelect={() => select(r.href)}>
                      <Icon className="size-4" />
                      <div className="flex flex-col">
                        <span>{r.title}</span>
                        <span className="text-muted-foreground text-xs">{r.subtitle}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
