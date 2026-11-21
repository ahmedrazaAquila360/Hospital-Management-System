import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the settings layout: header, section list on the left, form card on the right. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-13 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-6 xl:grid-cols-[18.5rem_minmax(0,1fr)]">
        <div className="surface-card flex gap-1 p-2 lg:flex-col">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3">
              <Skeleton className="size-9 rounded-lg" />
              <div className="hidden flex-1 space-y-1.5 lg:block">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>
        <div className="surface-card space-y-6 p-7">
          <div className="space-y-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-80 max-w-full" />
          </div>
          <div className="flex items-center gap-5">
            <Skeleton className="size-22 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-36" />
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
