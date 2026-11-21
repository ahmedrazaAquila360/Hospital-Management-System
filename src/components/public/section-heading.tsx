import { cn } from "@/lib/utils";
import { AnimatedReveal } from "@/components/public/animated-reveal";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
  className,
  light = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "left" | "center";
  className?: string;
  light?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl space-y-4", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && (
        <AnimatedReveal direction="fade">
          <span
            className={cn(
              "inline-flex items-center gap-2 text-xs font-semibold tracking-[0.18em] uppercase",
              light ? "text-cyan" : "text-[#5a7ea8]"
            )}
          >
            {eyebrow}
          </span>
        </AnimatedReveal>
      )}
      <AnimatedReveal delay={0.05}>
        <h2
          className={cn(
            "text-4xl leading-[1.04] font-semibold tracking-[-0.03em] text-balance sm:text-5xl lg:text-[3.4rem]",
            light ? "text-white" : "text-navy"
          )}
        >
          {title}
        </h2>
      </AnimatedReveal>
      {description && (
        <AnimatedReveal delay={0.1}>
          <p className={cn("text-lg leading-relaxed text-pretty", light ? "text-white/75" : "text-[#4a6585]")}>{description}</p>
        </AnimatedReveal>
      )}
    </div>
  );
}
