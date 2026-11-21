import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex w-full max-w-sm items-center justify-center py-24">
      <Loader2 className="text-muted-foreground size-6 animate-spin" />
    </div>
  );
}
