import { Skeleton } from "@/components/ui/skeleton";

/** Matches Permissions Management: header, tabs, role list and the permission matrix. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading permissions">
      <div className="flex items-center gap-4">
        <Skeleton className="size-13 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-80 max-w-[60vw]" />
        </div>
      </div>

      <div className="border-border/70 flex gap-6 border-b pb-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-32" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[19rem_minmax(0,1fr)]">
        {/* Role list */}
        <div className="surface-card flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between px-1">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-8 w-24 rounded-xl" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="border-border/70 flex items-center gap-3 rounded-xl border px-3 py-2.5">
              <Skeleton className="size-10 shrink-0 rounded-xl" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-5 w-6 rounded-full" />
            </div>
          ))}
        </div>

        {/* Editor */}
        <div className="surface-card flex min-w-0 flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Skeleton className="size-12 rounded-2xl" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-36" />
                <Skeleton className="h-4 w-72 max-w-[50vw]" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-36 rounded-xl" />
              <Skeleton className="h-9 w-36 rounded-xl" />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="border-border/70 flex items-center gap-3 rounded-2xl border p-4">
                <Skeleton className="size-11 rounded-xl" />
                <div className="space-y-1.5">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Skeleton className="h-10 w-full rounded-xl lg:max-w-sm" />
            <div className="flex gap-2 lg:ml-auto">
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-24 rounded-xl" />
              <Skeleton className="h-9 w-28 rounded-xl" />
            </div>
          </div>

          <div className="border-border/70 overflow-hidden rounded-2xl border">
            <div className="bg-muted/50 grid grid-cols-[minmax(10rem,1.6fr)_repeat(4,5.5rem)_minmax(8rem,1fr)] items-center gap-3 px-4 py-3">
              <Skeleton className="h-3.5 w-28" />
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-8 w-16" />
              ))}
              <Skeleton className="h-3.5 w-24" />
            </div>
            {Array.from({ length: 9 }, (_, i) => (
              <div
                key={i}
                className="border-border/60 grid grid-cols-[minmax(10rem,1.6fr)_repeat(4,5.5rem)_minmax(8rem,1fr)] items-center gap-3 border-t px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="size-4" />
                  <Skeleton className="size-5 rounded-md" />
                  <Skeleton className="h-4 w-28" />
                </div>
                {Array.from({ length: 4 }, (_, j) => (
                  <Skeleton key={j} className="size-5 rounded-md" />
                ))}
                <Skeleton className={i % 3 === 0 ? "h-4 w-28" : "h-4 w-4"} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
