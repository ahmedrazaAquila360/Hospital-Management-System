import {
  Cpu,
  GraduationCap,
  HeartHandshake,
  ReceiptText,
  Sofa,
  UserCheck,
} from "lucide-react";
import { StaggerGroup, StaggerItem } from "@/components/public/animated-reveal";
import { SectionHeading } from "@/components/public/section-heading";
import { GlassToothIllustration } from "@/components/brand/glass-tooth-illustration";
import { WHY_CHOOSE_US } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const ICONS = { GraduationCap, Cpu, Sofa, UserCheck, ReceiptText, HeartHandshake } as const;

export function WhyChooseUs() {
  return (
    <section id="why-us" className="px-3 py-6 sm:px-5">
      <div className="rounded-[28px] bg-[linear-gradient(180deg,#f2f8fd_0%,#e8f3fb_100%)] py-20 sm:rounded-[36px] sm:py-28">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Why Us" title="Why Patients Choose Us" align="center" />
          <StaggerGroup className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {WHY_CHOOSE_US.map((item, i) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS];
              const featured = i === 0;
              return (
                <StaggerItem key={item.title}>
                  <div
                    className={cn(
                      "group relative isolate flex h-full flex-col overflow-hidden rounded-3xl p-7 transition-[transform,box-shadow] duration-300 hover:-translate-y-1",
                      featured
                        ? "bg-navy-gradient text-white shadow-[0_30px_60px_-30px_rgb(8_44_86/0.8)]"
                        : "border border-white bg-white/80 shadow-[0_20px_40px_-30px_rgb(8_44_86/0.45)] backdrop-blur hover:shadow-[0_26px_50px_-28px_rgb(8_44_86/0.5)]"
                    )}
                  >
                    {featured && (
                      <GlassToothIllustration className="pointer-events-none absolute -right-8 -bottom-20 -z-10 w-36 opacity-70 transition-transform duration-700 group-hover:-translate-y-2 group-hover:rotate-3" />
                    )}
                    <span
                      className={cn(
                        "flex size-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-105",
                        featured ? "text-cyan border border-white/20 bg-white/10" : "bg-brand-gradient text-white shadow-glow"
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <p className={cn("font-heading mt-6 text-xl font-semibold tracking-tight", featured ? "text-white" : "text-navy")}>
                      {item.title}
                    </p>
                    <p className={cn("mt-2 text-[15px] leading-relaxed", featured ? "max-w-[15rem] text-white/75" : "max-w-xs text-[#4a6585]")}>
                      {item.description}
                    </p>
                  </div>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
