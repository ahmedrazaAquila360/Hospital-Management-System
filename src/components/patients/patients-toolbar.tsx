"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpDown, RotateCcw, Stethoscope, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";

const SELECT_TRIGGER = "h-11! w-full rounded-xl";

/**
 * Search, gender, dentist and sort — the filters `listPatients` supports. Every value lives in
 * the URL (the selects used to be uncontrolled, so Back/Forward left them showing stale values).
 */
export function PatientsToolbar({ dentists }: { dentists: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const gender = searchParams.get("gender") ?? "all";
  const dentistId = searchParams.get("dentistId") ?? "all";
  const sort = searchParams.get("sort") ?? "recent";
  const filtered = ["search", "gender", "dentistId", "sort"].some((k) => searchParams.get(k));

  function update(key: string, value: string, fallback: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === fallback) params.delete(key);
    else params.set(key, value);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function reset() {
    const params = new URLSearchParams();
    const perPage = searchParams.get("perPage");
    if (perPage) params.set("perPage", perPage);
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 xl:flex-row xl:items-center">
      <ListSearch placeholder="Search name, patient ID, phone or email…" param="search" className="xl:max-w-sm" />
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:ml-auto xl:flex-nowrap">
        <Select value={gender} onValueChange={(v) => update("gender", v, "all")}>
          <SelectTrigger className={`${SELECT_TRIGGER} sm:w-40`} aria-label="Filter by gender">
            <UsersRound className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All genders</SelectItem>
            <SelectItem value="MALE">Male</SelectItem>
            <SelectItem value="FEMALE">Female</SelectItem>
            <SelectItem value="OTHER">Other</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dentistId} onValueChange={(v) => update("dentistId", v, "all")}>
          <SelectTrigger className={`${SELECT_TRIGGER} sm:w-48`} aria-label="Filter by dentist">
            <Stethoscope className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All dentists</SelectItem>
            {dentists.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => update("sort", v, "recent")}>
          <SelectTrigger className={`${SELECT_TRIGGER} sm:w-44`} aria-label="Sort patients">
            <ArrowUpDown className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="recent">Newest first</SelectItem>
            <SelectItem value="oldest">Oldest first</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="outline" className="h-11 rounded-xl" onClick={reset}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
