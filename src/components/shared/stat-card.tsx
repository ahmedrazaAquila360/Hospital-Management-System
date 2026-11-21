import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TONES = {
  brand: { tile: "bg-pale text-brand", card: "from-white to-pale/40" },
  success: { tile: "bg-success/10 text-success", card: "from-white to-success/5" },
  destructive: { tile: "bg-destructive/10 text-destructive", card: "from-white to-destructive/5" },
  warning: { tile: "bg-warning/15 text-warning-foreground", card: "from-white to-warning/5" },
} as const;

/** Summary number card used at the top of list pages. Becomes a link when `href` is set. */
export function StatCard({
  icon: Icon,
  value,
  label,
  tone = "brand",
  href,
  active = false,
}: {
  icon: LucideIcon;
  value: number | string;
  label: string;
  tone?: keyof typeof TONES;
  href?: string;
  active?: boolean;
}) {
  const t = TONES[tone];
  const body = (
    <>
      <span className={cn("hidden size-12 shrink-0 items-center justify-center rounded-2xl sm:flex", t.tile)} aria-hidden>
        <Icon className="size-6" />
      </span>
      <span className="min-w-0">
        <span className="font-heading text-navy block text-2xl leading-none font-semibold tabular-nums sm:text-[1.7rem]">{value}</span>
        <span className="text-muted-foreground mt-1 block text-xs leading-tight sm:truncate sm:text-sm">{label}</span>
      </span>
    </>
  );
  const className = cn(
    "surface-card flex items-center gap-4 bg-linear-to-br p-3 sm:p-5",
    t.card,
    href && "hover:border-brand/30 focus-visible:ring-ring/60 transition-colors outline-none focus-visible:ring-2",
    active && "border-brand/40 ring-brand/15 ring-2"
  );
  return href ? (
    <Link href={href} className={className} aria-current={active ? "page" : undefined}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
