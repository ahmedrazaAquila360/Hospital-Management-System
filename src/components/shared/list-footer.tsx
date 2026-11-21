"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataPagination } from "@/components/shared/data-pagination";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pagination";
import { cn } from "@/lib/utils";

/**
 * Footer shared by every listing page: "Showing a–b of N", a rows-per-page picker
 * (10 / 20 / 30 / 50, kept in `?perPage=`) and the page links. Links keep every other
 * filter in the URL, so pages don't each rebuild their own hrefs.
 */
export function ListFooter({
  page,
  pageSize,
  total,
  shown,
  noun = "record",
  nounPlural,
  extra,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  /** Rows on this page. */
  shown: number;
  noun?: string;
  nounPlural?: string;
  /** Appended after the count, e.g. a filtered sum. */
  extra?: string;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  if (total === 0) return null;

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const first = shown ? (page - 1) * pageSize + 1 : 0;
  const last = shown ? first + shown - 1 : 0;

  function buildHref(p: number) {
    const sp = new URLSearchParams(searchParams.toString());
    if (p > 1) sp.set("page", String(p));
    else sp.delete("page");
    const qs = sp.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  function setPageSize(value: string) {
    const sp = new URLSearchParams(searchParams.toString());
    if (Number(value) === DEFAULT_PAGE_SIZE) sp.delete("perPage");
    else sp.set("perPage", value);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <footer
      className={cn(
        "border-border/70 flex flex-col items-center gap-3 border-t px-4 py-4 sm:px-5 lg:flex-row lg:justify-between",
        className
      )}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <p className="text-muted-foreground text-sm tabular-nums">
          {shown ? (
            <>
              Showing <span className="text-navy font-semibold">{first}–{last}</span> of{" "}
              <span className="text-navy font-semibold">{total}</span> {total === 1 ? noun : (nounPlural ?? `${noun}s`)}
            </>
          ) : (
            <>No rows on this page · {total} in total</>
          )}
          {extra && <> · {extra}</>}
        </p>
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <span aria-hidden>Rows per page</span>
          <Select value={String(pageSize)} onValueChange={setPageSize}>
            <SelectTrigger size="sm" className="h-9! w-20 rounded-lg" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {PAGE_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isPending && <Loader2 className="text-brand size-4 animate-spin" aria-label="Loading" />}
        </div>
      </div>
      <div className="[&_nav]:mx-0 [&_nav]:w-auto">
        <DataPagination page={page} pageCount={pageCount} buildHref={buildHref} />
      </div>
    </footer>
  );
}
