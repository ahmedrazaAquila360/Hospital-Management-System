import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import { AnimatedReveal } from "@/components/public/animated-reveal";
import { PillCta } from "@/components/public/pill-cta";
import { SITE_IMAGES } from "@/lib/site-content";

const BENEFITS = [
  "Personalized smile design consultation",
  "Modern, minimally invasive techniques",
  "Comfortable, judgment-free experience",
  "Transparent pricing with no surprises",
];

export function FeaturedTreatment() {
  return (
    <section className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2 lg:gap-20">
        <AnimatedReveal direction="left" className="relative order-1">
          <div className="relative aspect-[4/5] overflow-hidden rounded-[32px] bg-[#1d5aa3] shadow-[0_40px_80px_-40px_rgb(8_44_86/0.6)] sm:aspect-[5/5] lg:aspect-[4/5]">
            <Image
              src={SITE_IMAGES.featuredTreatment}
              alt="Close-up of a bright, healthy smile after cosmetic dental treatment"
              fill
              sizes="(min-width: 1024px) 45vw, 90vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(200deg,transparent_40%,rgb(8_44_86/0.55)_100%)]" />
          </div>
          <div className="absolute -right-3 bottom-8 max-w-[15rem] rounded-2xl border border-white/70 bg-white/80 p-4 shadow-[0_24px_50px_-24px_rgb(8_44_86/0.5)] backdrop-blur-md sm:-right-8">
            <span className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl text-white">
              <Sparkles className="size-4.5" />
            </span>
            <p className="text-navy mt-3 text-sm leading-snug font-semibold">Personalized smile design consultation</p>
          </div>
        </AnimatedReveal>

        <AnimatedReveal direction="right" className="order-2">
          <span className="text-xs font-semibold tracking-[0.18em] text-[#5a7ea8] uppercase">Featured Treatment</span>
          <h2 className="text-navy mt-4 text-4xl leading-[1.04] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            Transform Your Smile With Modern Cosmetic Dentistry
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-[#4a6585]">
            Whether it&apos;s whitening, bonding, veneers or a full smile makeover, our cosmetic treatments combine
            modern technology with an artistic eye — so results look natural, not artificial.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3 rounded-2xl border border-[#e3edf6] bg-[#f7fbfe] p-4 text-sm font-medium text-[#2c4a70]">
                <span className="bg-brand-gradient mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white">
                  <Check className="size-3.5" />
                </span>
                {b}
              </li>
            ))}
          </ul>
          <PillCta href="/book" size="lg" className="mt-10">
            Book a Consultation
          </PillCta>
        </AnimatedReveal>
      </div>
    </section>
  );
}
