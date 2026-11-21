"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CircleDot, RotateCcw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";
import { TREATMENT_STATUSES } from "@/lib/validations/treatment";
import { TREATMENT_STATUS_LABEL } from "@/lib/labels";

/**
 * Search (treatment or patient), status and dentist — the filters `listTreatments` supports.
 * Values are read from the URL (the selects used to be uncontrolled and went stale on Back).
 */
export function TreatmentsToolbar({ dentists }: { dentists: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const status = searchParams.get("status") ?? "all";
  const dentistId = searchParams.get("dentistId") ?? "all";
  const filtered = ["search", "status", "dentistId", "sort"].some((k) => searchParams.get(k));

  function update(key: string, value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  function reset() {
    const perPage = searchParams.get("perPage");
    startTransition(() => router.replace(perPage ? `${pathname}?perPage=${perPage}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
      <ListSearch placeholder="Search treatment or patient…" param="search" className="lg:max-w-sm" />
      <div className="grid grid-cols-2 gap-2 sm:flex">
        <Select value={status} onValueChange={(v) => update("status", v)}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-44" aria-label="Filter by status">
            <CircleDot className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TREATMENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TREATMENT_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dentistId} onValueChange={(v) => update("dentistId", v)}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-52" aria-label="Filter by dentist">
            <Stethoscope className="text-muted-foreground" />
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
      </div>
      {filtered && (
        <Button variant="ghost" className="text-brand h-11 rounded-xl lg:ml-auto" onClick={reset}>
          <RotateCcw /> Reset
        </Button>
      )}
    </div>
  );
}
