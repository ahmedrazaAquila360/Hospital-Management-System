"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";

/**
 * Search (patient name, the only field the prescriptions query searches) and the doctor
 * filter the query already supports. Both live in the URL.
 */
export function PrescriptionsToolbar({ dentists }: { dentists: { id: string; name: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const dentistId = searchParams.get("dentistId") ?? "all";
  const filtered = Boolean(searchParams.get("search") || searchParams.get("dentistId"));

  function setDentist(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("dentistId");
    else params.set("dentistId", value);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
      <ListSearch placeholder="Search by patient name…" param="search" className="lg:max-w-md" />
      <div className="flex gap-2 lg:ml-auto">
        <Select value={dentistId} onValueChange={setDentist}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-52" aria-label="Filter by doctor">
            <Stethoscope className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All doctors</SelectItem>
            {dentists.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="outline" className="h-11 rounded-xl" onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
