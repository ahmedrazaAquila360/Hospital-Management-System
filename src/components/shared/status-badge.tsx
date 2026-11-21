import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/format";
import { toneClasses, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string;
  tone: StatusTone;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(toneClasses(tone), "gap-1.5 font-medium", className)}>
      <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />
      {titleCase(status)}
    </Badge>
  );
}
