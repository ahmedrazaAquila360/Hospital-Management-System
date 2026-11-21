import { Phone } from "lucide-react";
import { AnimatedReveal } from "@/components/public/animated-reveal";
import { GlassToothIllustration } from "@/components/brand/glass-tooth-illustration";
import { PillCta } from "@/components/public/pill-cta";
import type { getClinicSettings } from "@/server/settings/queries";

export function Cta({ clinic }: { clinic: Awaited<ReturnType<typeof getClinicSettings>> }) {
  return (
    <section className="relative isolate overflow-hidden py-24 sm:py-32">
      {/* Soft halos with floating glass teeth on either side. */}
      <div aria-hidden className="absolute top-1/2 -left-40 -z-10 hidden size-[30rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#eef6fc_55%,#f6fafd_56%,#f6fafd_70%,transparent_71%)] md:block" />
      <div aria-hidden className="absolute top-1/2 -right-40 -z-10 hidden size-[30rem] -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#eef6fc_55%,#f6fafd_56%,#f6fafd_70%,transparent_71%)] md:block" />
      <GlassToothIllustration className="animate-float pointer-events-none absolute top-1/2 left-[2%] -z-10 hidden w-40 -translate-y-1/2 -rotate-12 md:block lg:left-[5%] lg:w-52" />
      <GlassToothIllustration className="animate-float pointer-events-none absolute top-1/2 right-[2%] -z-10 hidden w-36 -translate-y-1/2 rotate-12 [animation-delay:1.5s] md:block lg:right-[5%] lg:w-44" />

      <div className="relative mx-auto w-full max-w-3xl px-5 text-center sm:px-8">
        <AnimatedReveal direction="fade">
          <span className="text-xs font-semibold tracking-[0.18em] text-[#5a7ea8] uppercase">Book Your Visit</span>
        </AnimatedReveal>
        <AnimatedReveal delay={0.05}>
          <h2 className="text-navy mt-4 text-4xl leading-[1.04] font-semibold tracking-[-0.035em] text-balance sm:text-5xl lg:text-6xl">
            Ready to Take Care of Your Smile?
          </h2>
        </AnimatedReveal>
        <AnimatedReveal delay={0.1}>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[#4a6585]">
            Schedule your visit today and take the first step toward healthier, more confident teeth.
          </p>
        </AnimatedReveal>
        <AnimatedReveal delay={0.2}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <PillCta href="/book" size="lg">
              Book Your Appointment
            </PillCta>
            {clinic.phone && (
              <a
                href={`tel:${clinic.phone.replace(/[^+\d]/g, "")}`}
                className="text-navy hover:bg-pale inline-flex h-[60px] items-center gap-2.5 rounded-full border border-[#cfe2f2] bg-white px-6 text-base font-semibold transition-colors"
              >
                <Phone className="text-brand size-4.5" /> Call the Clinic
              </a>
            )}
          </div>
        </AnimatedReveal>
      </div>
    </section>
  );
}
