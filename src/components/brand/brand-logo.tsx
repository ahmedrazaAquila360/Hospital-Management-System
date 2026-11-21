import { Hospital } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

export const TOOTH_PATH =
  "M7.5 3C5 3 3.5 5 3.5 7.6c0 2.2.9 3.6 1.5 5.4.7 2.2.8 4.4 1.3 6.3.3 1.2.8 1.7 1.5 1.7 1 0 1.3-1 1.6-2.4.4-1.8.8-3.6 2.6-3.6s2.2 1.8 2.6 3.6c.3 1.4.6 2.4 1.6 2.4.7 0 1.2-.5 1.5-1.7.5-1.9.6-4.1 1.3-6.3.6-1.8 1.5-3.2 1.5-5.4C20.5 5 19 3 16.5 3c-1.8 0-2.8 1-4.5 1S9.3 3 7.5 3Z";

/** Glossy tooth glyph used as the DentalHub mark. `tone` picks the gradient for light or navy surfaces. */
export function BrandMark({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const stops = tone === "dark" ? ["#b8ecff", "#4fd0f3", "#1592d5"] : ["#4fd0f3", "#0f8ad0", "#073b7a"];

  return (
    <svg viewBox="0 0 24 24" className={cn("size-8", className)} aria-hidden>
      <defs>
        <linearGradient id={`bm-fill-${id}`} x1="4" y1="3" x2="19" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={stops[0]} />
          <stop offset="0.5" stopColor={stops[1]} />
          <stop offset="1" stopColor={stops[2]} />
        </linearGradient>
        <linearGradient id={`bm-shine-${id}`} x1="6" y1="3" x2="12" y2="13" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={TOOTH_PATH} fill={`url(#bm-fill-${id})`} />
      <path
        d="M7.4 4.6c-1.9 0-2.6 1.6-2.6 3.1 0 1.4.5 2.5.9 3.6"
        fill="none"
        stroke={`url(#bm-shine-${id})`}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="16.6" cy="6.4" r="0.9" fill="#fff" opacity="0.85" />
    </svg>
  );
}

export function BrandLogo({
  name = "DentalHub",
  subtitle,
  tone = "light",
  className,
  markClassName,
  nameClassName,
}: {
  name?: string;
  subtitle?: string;
  tone?: "light" | "dark";
  className?: string;
  markClassName?: string;
  nameClassName?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", className)}>
      {name === "Hospital Hub" ? <Hospital aria-hidden className={cn("size-9 shrink-0 text-cyan",markClassName)} /> : <BrandMark tone={tone} className={cn("size-9 shrink-0 drop-shadow-[0_6px_10px_rgb(8_127_196/0.35)]", markClassName)} />}
      <span className="grid min-w-0 leading-tight">
        <span
          className={cn(
            "font-heading truncate text-[1.05rem] font-semibold tracking-tight",
            tone === "dark" ? "text-white" : "text-navy",
            nameClassName
          )}
        >
          {name}
        </span>
        {subtitle && (
          <span className={cn("truncate text-xs", tone === "dark" ? "text-sidebar-foreground/80" : "text-muted-foreground")}>
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}

/** Faint tooth outline used as a corner watermark in page headers. */
export function ToothOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("text-brand/10 pointer-events-none size-24", className)} aria-hidden>
      <path d={TOOTH_PATH} fill="none" stroke="currentColor" strokeWidth="0.7" strokeLinejoin="round" />
    </svg>
  );
}
