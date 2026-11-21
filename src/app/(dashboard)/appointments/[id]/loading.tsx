import { Skeleton } from "@/components/ui/skeleton";

/** Matches Appointment Details: patient overview, visit details + timeline, and the quick actions. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5" aria-busy="true" aria-label="Loading appointment">
      <div className="flex items-center gap-2">
        <Skeleton className="size-8 rounded-full" />
        <Skeleton className="h-4 w-40" />
      </div>

      {/* Patient overview */}
      <section className="surface-card flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4 sm:gap-5">
          <Skeleton className="size-16 shrink-0 rounded-full sm:size-[5.25rem]" />
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-44" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-36 rounded-full" />
          <Skeleton className="h-10 w-24 rounded-full" />
          <Skeleton className="size-11 rounded-full" />
        </div>
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Visit details */}
        <section className="surface-card p-5 sm:p-6">
          <div className="border-border/70 mb-2 flex items-center gap-3 border-b pb-4">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="grid sm:grid-cols-2 sm:gap-x-8">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={i < 2 ? "border-border/70 flex items-center gap-3.5 border-b py-4" : "flex items-center gap-3.5 py-4"}>
                <Skeleton className="size-11 shrink-0 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Timeline */}
        <section className="surface-card p-5 sm:p-6">
          <div className="border-border/70 mb-3 flex items-center gap-3 border-b pb-4">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <div className="flex flex-col gap-5">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-start gap-4">
                <Skeleton className="size-[1.875rem] shrink-0 rounded-full" />
                <div className="space-y-1.5 pt-0.5">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className={i < 2 ? "h-3.5 w-40" : "h-3.5 w-6"} />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Continue the visit */}
      <section className="surface-card p-5 sm:p-6">
        <div className="border-border/70 mb-4 flex items-center gap-3 border-b pb-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-5 w-40" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="border-border/70 flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border px-3 py-5">
              <Skeleton className="size-7 rounded-lg" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
