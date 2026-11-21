import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE = {
  primary: { icon: "from-[#e3f4fd] to-[#cfeafb] text-brand ring-[#c7e5f7]", bar: "bg-brand" },
  success: { icon: "from-[#e5f6ee] to-[#d0eedf] text-success ring-[#c4e9d6]", bar: "bg-success" },
  warning: { icon: "from-[#fff4e1] to-[#fde8c6] text-warning-foreground ring-[#f5dcae]", bar: "bg-warning" },
  destructive: { icon: "from-[#fdeef0] to-[#fadbe0] text-destructive ring-[#f5ccd2]", bar: "bg-destructive" },
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "primary",
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  hint?: string;
  tone?: "primary" | "success" | "warning" | "destructive";
}) {
  const t = TONE[tone];

  return (
    <div className="group surface-card relative h-full overflow-hidden p-4 transition-[box-shadow,transform,border-color] duration-300 hover:-translate-y-0.5 hover:border-[#c9def0] hover:shadow-elevated sm:p-5">
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5 opacity-0 transition-opacity group-hover:opacity-100", t.bar)} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ring-1 ring-inset sm:size-12",
            t.icon
          )}
        >
          <Icon className="size-5 sm:size-5.5" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground truncate text-[13px] font-medium">{label}</p>
          <p className="font-heading text-navy text-xl leading-none font-semibold tracking-tight sm:text-[1.65rem]">{value}</p>
          {hint && <p className="text-muted-foreground pt-0.5 text-xs">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
