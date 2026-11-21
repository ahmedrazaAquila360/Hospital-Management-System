import { Skeleton } from "@/components/ui/skeleton";

/** Matches the calendar layout: header, toolbar, then a time grid. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-4">
        <Skeleton className="size-13 rounded-2xl" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="surface-card grid grid-cols-[4.5rem_repeat(7,minmax(0,1fr))] gap-px overflow-hidden p-0">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-none" />
        ))}
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={`b${i}`} className="h-[28rem] rounded-none opacity-60" />
        ))}
      </div>
    </div>
  );
}
