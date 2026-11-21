"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { GlassTooth } from "@/components/brand/glass-tooth";
import { PillCta } from "@/components/public/pill-cta";
import { HERO_BADGES } from "@/lib/site-content";

const EASE = [0.22, 1, 0.36, 1] as const;

export function Hero({ clinicName }: { clinicName: string }) {
  return (
    <section id="home" className="relative isolate overflow-hidden pt-6 pb-28 sm:pt-10 sm:pb-40 xl:pb-52">
      {/* Soft clinical light behind the tooth. */}
      <div aria-hidden className="absolute top-1/3 left-1/2 -z-10 size-[44rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#dff2fd_0%,#f2f9fe_45%,transparent_70%)]" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, #cfe3f3 1px, transparent 0)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse at 50% 30%, black 20%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-6">
        <div className="lg:col-span-5">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-pale text-brand mb-6 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide uppercase ring-1 ring-[#d3e8f5]"
          >
            <ShieldCheck className="size-3.5" /> {clinicName}
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: EASE }}
            className="text-navy text-[2.9rem] leading-[0.98] font-semibold tracking-[-0.04em] text-balance sm:text-6xl xl:text-[5.1rem]"
          >
            Your Smile Deserves Exceptional Care.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            className="mt-7 max-w-md text-lg leading-relaxed text-[#4a6585]"
          >
            Personalized dental care combining modern technology, clinical expertise and a genuinely comfortable
            patient experience.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4"
          >
            <PillCta href="/book" size="lg">
              Book an Appointment
            </PillCta>
            <a
              href="#services"
              className="group text-navy hover:text-brand inline-flex items-center gap-2 text-[15px] font-semibold transition-colors"
            >
              Explore Our Services
              <span className="bg-pale flex size-8 items-center justify-center rounded-full ring-1 ring-[#d3e8f5] transition-transform group-hover:translate-x-1">
                <ArrowRight className="size-4" />
              </span>
            </a>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.1, ease: EASE }}
          className="relative mx-auto w-full max-w-md lg:col-span-4 lg:max-w-none"
        >
          <GlassTooth className="mx-auto aspect-[4/5] w-full max-w-[420px]" />

          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-[14%] -left-2 rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_40px_-20px_rgb(8_44_86/0.45)] backdrop-blur-md sm:left-0"
          >
            <p className="font-heading text-navy text-xl leading-none font-semibold">{HERO_BADGES[0].label.split(" ")[0]}</p>
            <p className="mt-1 text-xs font-medium text-[#4a6585]">{HERO_BADGES[0].label.split(" ").slice(1).join(" ")}</p>
          </motion.div>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            className="absolute right-0 bottom-[18%] rounded-2xl border border-white/70 bg-white/70 px-4 py-3 shadow-[0_18px_40px_-20px_rgb(8_44_86/0.45)] backdrop-blur-md"
          >
            <p className="font-heading text-navy text-xl leading-none font-semibold">{HERO_BADGES[1].label.split(" ")[0]}</p>
            <p className="mt-1 text-xs font-medium text-[#4a6585]">{HERO_BADGES[1].label.split(" ").slice(1).join(" ")}</p>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.35, ease: EASE }}
          className="lg:col-span-3"
        >
          <p className="font-heading text-navy text-3xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-4xl lg:text-[2.6rem]">
            Modern Dentistry. Healthier Smiles.
          </p>
          <ul className="mt-8 divide-y divide-[#e3edf6] border-y border-[#e3edf6]">
            {HERO_BADGES.map((badge) => (
              <li key={badge.label} className="flex items-center gap-3 py-3.5 text-sm font-medium text-[#2c4a70]">
                <span className="bg-pale text-brand flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-[#d3e8f5]">
                  <Sparkles className="size-3.5" />
                </span>
                {badge.label}
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <p
        aria-hidden
        className="font-heading pointer-events-none absolute inset-x-0 bottom-0 -z-10 translate-y-[18%] overflow-hidden text-center text-[10.5vw] leading-none font-semibold tracking-[-0.05em] whitespace-nowrap text-[#edf4fb] select-none"
      >
        {clinicName} — Healthier Smiles.
      </p>
    </section>
  );
}
