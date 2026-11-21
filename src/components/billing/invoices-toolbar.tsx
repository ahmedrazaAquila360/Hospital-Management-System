"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";
import { INVOICE_STATUS_LABEL } from "@/lib/labels";

/** Search (invoice # or patient) and status — the filters the invoices query supports. */
export function InvoicesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  // Reads from the URL so Back/Forward keep it in sync (it was an uncontrolled defaultValue).
  const status = searchParams.get("status") ?? "all";
  const filtered = Boolean(searchParams.get("search") || searchParams.get("status"));

  function setStatus(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("status");
    else params.set("status", value);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
      <ListSearch placeholder="Search invoice # or patient…" param="search" className="lg:max-w-md" />
      <div className="flex gap-2 lg:ml-auto">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-48" aria-label="Filter by status">
            <Tag className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(INVOICE_STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
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
