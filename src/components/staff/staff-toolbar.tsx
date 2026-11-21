"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";

/** Name/email search and role filter — what `listStaff` supports. Both live in the URL. */
export function StaffToolbar({ roles }: { roles: { name: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const role = searchParams.get("role") ?? "all";
  const filtered = Boolean(searchParams.get("search") || searchParams.get("role"));

  function setRole(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("role");
    else params.set("role", value);
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
      <ListSearch placeholder="Search staff by name or email…" param="search" className="lg:max-w-md" />
      <div className="flex gap-2 lg:ml-auto">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-52" aria-label="Filter by role">
            <ShieldCheck className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.name} value={r.name}>
                {r.label}
              </SelectItem>
            ))}
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
