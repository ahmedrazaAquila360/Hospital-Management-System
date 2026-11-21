import { Skeleton } from "@/components/ui/skeleton";

/** Matches the redesigned Notifications page: header, category tabs and the full-width list. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading notifications">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-13 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-44" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-10 w-44 rounded-full" />
      </div>

      <div className="bg-muted/70 flex w-fit max-w-full gap-1 overflow-hidden rounded-2xl p-1">
        {[16, 24, 36, 28, 26].map((w, i) => (
          <Skeleton key={i} className="h-10 rounded-xl bg-white/80" style={{ width: `${w * 0.25}rem` }} />
        ))}
      </div>

      <div className="surface-card overflow-hidden p-0">
        <ul className="divide-border/60 divide-y">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className={i < 2 ? "bg-pale/40 relative flex items-start gap-4 px-4 py-4 sm:px-6" : "flex items-start gap-4 px-4 py-4 sm:px-6"}>
              {i < 2 && <span className="bg-brand/30 absolute inset-y-2 left-0 w-1 rounded-r-full" aria-hidden />}
              <Skeleton className="size-11 shrink-0 rounded-2xl" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-4 w-48 max-w-[60%]" />
                <Skeleton className="h-3.5 w-full max-w-xl" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className={i < 2 ? "hidden h-8 w-32 self-center rounded-lg sm:block" : "hidden h-6 w-16 self-center rounded-full sm:block"} />
            </li>
          ))}
        </ul>
        <div className="border-border/70 flex items-center justify-between gap-3 border-t px-5 py-4">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-9 w-40 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
