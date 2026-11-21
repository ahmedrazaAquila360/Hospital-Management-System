import { Skeleton } from "@/components/ui/skeleton";

/** Loading state for the record forms (staff, patients): photo card left, sections right. */
export function RecordFormSkeleton({ sections = [4, 1, 1] }: { sections?: number[] }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex items-center gap-4">
        <Skeleton className="size-13 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[19rem_minmax(0,1fr)] 2xl:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="surface-card flex flex-col items-center gap-4 p-6">
          <Skeleton className="size-32 rounded-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
        <div className="surface-card space-y-8 p-7">
          {sections.map((fields, section) => (
            <div key={section} className="space-y-5">
              <Skeleton className="h-6 w-48" />
              <div className="grid gap-5 md:grid-cols-2">
                {Array.from({ length: fields }, (_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-11 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
