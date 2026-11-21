import { Skeleton } from "@/components/ui/skeleton";

/** Matches the redesigned Treatment Details: header, overview + cost, tabs and the action bar. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" aria-busy="true" aria-label="Loading treatment">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-36" />
      </div>

      {/* Header */}
      <section className="surface-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 shrink-0 rounded-2xl" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-64 max-w-[55vw]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-10 w-36 rounded-xl" />
          <Skeleton className="size-10 rounded-xl" />
        </div>
      </section>

      {/* Overview + cost */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <section className="surface-card p-5 sm:p-6">
          <Skeleton className="h-6 w-44" />
          <div className="border-border/70 mt-4 grid gap-4 border-t py-5 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-12 shrink-0 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
          <div className="border-border/70 flex items-start gap-3 border-t pt-5">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <Skeleton className="h-6 w-36" />
          <div className="border-border/70 mt-4 border-t">
            {Array.from({ length: 2 }, (_, i) => (
              <div key={i} className="border-border/60 flex items-center gap-3 border-b px-1 py-3">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="ml-auto h-5 w-24" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-3 h-[4.25rem] w-full rounded-2xl" />
        </section>
      </div>

      {/* Tabs */}
      <div className="surface-card flex gap-6 px-5 py-4">
        {[16, 14, 20, 18].map((w, i) => (
          <Skeleton key={i} className="h-5" style={{ width: `${w * 0.25}rem` }} />
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {Array.from({ length: 2 }, (_, i) => (
          <section key={i} className="surface-card p-5 sm:p-6">
            <div className="border-border/70 mb-4 flex items-center gap-3 border-b pb-4">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-5 w-36" />
            </div>
            {i === 0 ? (
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }, (_, j) => (
                  <Skeleton key={j} className="h-9 w-40 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-14" />
                  <Skeleton className="h-9 w-40 rounded-xl" />
                </div>
                <Skeleton className="h-14 w-full rounded-xl" />
              </div>
            )}
          </section>
        ))}
      </div>

      {/* Action bar */}
      <div className="surface-card flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:p-5">
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-xl" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
    </div>
  );
}
