import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, Cpu, HeartHandshake, ArrowRight, Quote } from "lucide-react";
import { AnimatedReveal } from "@/components/public/animated-reveal";
import { Stats } from "@/components/public/stats";
import { SITE_IMAGES, ABOUT_CREDENTIALS } from "@/lib/site-content";

const ICONS = { BadgeCheck, Cpu, HeartHandshake } as const;

export function AboutDentist() {
  return (
    <section id="about" className="px-3 py-6 sm:px-5 lg:py-10">
      <div className="relative isolate overflow-hidden rounded-[28px] bg-[#1d5aa3] sm:rounded-[36px]">
        {/* Photo washed in brand blue (a duotone feel). */}
        <Image
          src={SITE_IMAGES.aboutDentist}
          alt=""
          aria-hidden
          fill
          sizes="100vw"
          className="-z-20 object-cover opacity-60 mix-blend-luminosity"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(105deg,rgb(8_44_86/0.92)_0%,rgb(13_79_151/0.82)_45%,rgb(33_110_190/0.55)_100%)]" />

        <div className="mx-auto w-full max-w-7xl px-6 py-14 sm:px-10 sm:py-20 lg:px-14 lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <AnimatedReveal direction="fade">
                <span className="text-cyan text-xs font-semibold tracking-[0.18em] uppercase">About the Dentist</span>
              </AnimatedReveal>
              <AnimatedReveal delay={0.05}>
                <h2 className="mt-4 text-4xl leading-[1.02] font-semibold tracking-[-0.035em] text-balance text-white sm:text-5xl lg:text-[3.6rem]">
                  Expert Care With a Personal Touch
                </h2>
              </AnimatedReveal>
              <AnimatedReveal delay={0.1}>
                <p className="mt-6 max-w-xl text-base leading-relaxed text-white/80 sm:text-lg">
                  With years of hands-on clinical experience, our dental team combines rigorous training with a genuine,
                  patient-first philosophy. We invest in modern treatment technology so procedures are faster, more
                  precise, and more comfortable — because painless, judgment-free dentistry shouldn&apos;t be the
                  exception.
                </p>
              </AnimatedReveal>

              <div className="mt-8 flex flex-wrap gap-2.5">
                {ABOUT_CREDENTIALS.map((c, i) => {
                  const Icon = ICONS[c.icon as keyof typeof ICONS];
                  return (
                    <AnimatedReveal key={c.label} direction="up" delay={0.15 + i * 0.08}>
                      <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 py-1.5 pr-4 pl-1.5 text-sm font-medium text-white backdrop-blur-md">
                        <span className="text-cyan flex size-7 items-center justify-center rounded-full bg-white/12">
                          <Icon className="size-4" />
                        </span>
                        {c.label}
                      </span>
                    </AnimatedReveal>
                  );
                })}
              </div>
            </div>

            <AnimatedReveal direction="right" delay={0.15} className="flex flex-col justify-between gap-6 lg:col-span-5 lg:items-end">
              <figure className="max-w-sm rounded-3xl border border-white/20 bg-white/10 p-6 backdrop-blur-md">
                <Quote className="text-cyan size-7" />
                <blockquote className="mt-3 text-lg leading-snug font-medium text-balance text-white">
                  &ldquo;We treat every patient like family — comfort first, always.&rdquo;
                </blockquote>
              </figure>
              <Link
                href="#contact"
                className="group text-navy hover:bg-pale inline-flex w-fit items-center gap-2 rounded-full bg-white py-2 pr-2 pl-5 text-sm font-semibold shadow-lg transition-colors"
              >
                Meet Your Dentist
                <span className="bg-brand-gradient flex size-8 items-center justify-center rounded-full text-white transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </AnimatedReveal>
          </div>

          <Stats className="mt-14 lg:mt-20" />
        </div>
      </div>
    </section>
  );
}
