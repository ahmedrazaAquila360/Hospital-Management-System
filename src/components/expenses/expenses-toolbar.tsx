"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RotateCcw, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListSearch } from "@/components/shared/list-search";
import { EXPENSE_CATEGORIES } from "@/lib/validations/expense";
import { EXPENSE_CATEGORY_LABEL } from "@/lib/labels";

/** Title search and category filter — what the expenses query supports. Both live in the URL. */
export function ExpensesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const category = searchParams.get("category") ?? "all";
  const filtered = Boolean(searchParams.get("search") || searchParams.get("category"));

  function setCategory(value: string) {
    const params = new URLSearchParams(window.location.search);
    if (value === "all") params.delete("category");
    else params.set("category", value);
    params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center">
      <ListSearch placeholder="Search expenses by title…" param="search" className="lg:max-w-md" />
      <div className="flex gap-2 lg:ml-auto">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="h-11! w-full rounded-xl sm:w-52" aria-label="Filter by category">
            <Tag className="text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="all">All categories</SelectItem>
            {EXPENSE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {EXPENSE_CATEGORY_LABEL[c]}
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
