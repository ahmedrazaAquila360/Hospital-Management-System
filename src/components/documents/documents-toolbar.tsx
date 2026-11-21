"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Layers, RotateCcw, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";
import { DOCUMENT_TYPES } from "@/lib/validations/document";

const TYPE_LABEL: Record<string, string> = { XRAY: "X-Ray", REPORT: "Report", IMAGE: "Image", PDF: "PDF", OTHER: "Other" };

/** Name search, patient and type filters for the documents query. All three live in the URL. */
export function DocumentsToolbar({ patients }: { patients: { id: string; fullName: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const patientId = searchParams.get("patientId") ?? "all";
  const type = searchParams.get("type") ?? "all";
  const filtered = ["search", "patientId", "type"].some((k) => searchParams.get(k));

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
      <ListSearch placeholder="Search documents by name…" param="search" className="lg:max-w-sm" />
      <div className="grid grid-cols-2 gap-2 sm:flex lg:ml-auto">
        <Select value={patientId} onValueChange={(v) => update("patientId", v)}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-52" aria-label="Filter by patient">
            <UserRound className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All patients</SelectItem>
            {patients.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={(v) => update("type", v)}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-40" aria-label="Filter by type">
            <Layers className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All types</SelectItem>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button variant="outline" className="col-span-2 h-11 rounded-xl" onClick={reset}>
            <RotateCcw /> Reset
          </Button>
        )}
      </div>
    </div>
  );
}
