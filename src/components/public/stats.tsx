import { StaggerGroup, StaggerItem } from "@/components/public/animated-reveal";
import { AnimatedCounter } from "@/components/public/animated-counter";
import { STATS } from "@/lib/site-content";
import { cn } from "@/lib/utils";

/** Clinic figures as frosted tiles — designed to sit on the blue About panel. */
export function Stats({ className }: { className?: string }) {
  return (
    <StaggerGroup className={cn("grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4", className)}>
      {STATS.map((stat) => (
        <StaggerItem key={stat.label}>
          <div className="h-full rounded-2xl border border-white/20 bg-white/12 p-5 backdrop-blur-md transition-colors hover:bg-white/18 sm:p-6">
            <p className="font-heading text-4xl leading-none font-semibold tracking-[-0.04em] text-white sm:text-5xl">
              <AnimatedCounter value={stat.value} suffix={stat.suffix} />
            </p>
            <p className="mt-3 text-sm font-medium text-white/85 sm:text-base">{stat.label}</p>
          </div>
        </StaggerItem>
      ))}
    </StaggerGroup>
  );
}
