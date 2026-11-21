import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="size-10 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <div className="flex flex-col items-center gap-8 py-6">
        <div className="flex gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="size-10 rounded-lg sm:size-12" />
          ))}
        </div>
        <div className="flex gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <Skeleton key={i} className="size-10 rounded-lg sm:size-12" />
          ))}
        </div>
      </div>
    </div>
  );
}
