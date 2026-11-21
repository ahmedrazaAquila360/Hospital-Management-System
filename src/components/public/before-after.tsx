"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Hand } from "lucide-react";
import { SectionHeading } from "@/components/public/section-heading";
import { BeforeAfterSlider } from "@/components/public/before-after-slider";
import { PillCta } from "@/components/public/pill-cta";
import { BEFORE_AFTER } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export function BeforeAfter() {
  const [active, setActive] = useState(0);
  const item = BEFORE_AFTER[active];

  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Smile Transformations"
          title="Real Techniques, Elegant Results"
          description="Drag the slider to compare. Sample cases shown for illustration — ask us about results for your specific case."
          align="center"
        />

        <div role="tablist" aria-label="Smile transformation cases" className="mx-auto mt-10 flex w-fit max-w-full gap-1 overflow-x-auto border-b border-[#e3edf6]">
          {BEFORE_AFTER.map((c, i) => (
            <button
              key={c.title}
              type="button"
              role="tab"
              aria-selected={active === i}
              onClick={() => setActive(i)}
              className={cn(
                "relative cursor-pointer px-5 pt-2 pb-3.5 text-[15px] font-semibold whitespace-nowrap transition-colors",
                active === i ? "text-brand" : "text-[#5a7ea8] hover:text-navy"
              )}
            >
              {c.title}
              {active === i && (
                <motion.span layoutId="ba-tab" className="bg-brand absolute inset-x-3 -bottom-px h-0.5 rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="mt-12 grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3 }}
              >
                <p className="text-xs font-semibold tracking-[0.18em] text-[#5a7ea8] uppercase">
                  Case {String(active + 1).padStart(2, "0")}
                </p>
                <h3 className="text-navy mt-3 text-3xl leading-tight font-semibold tracking-[-0.03em] sm:text-4xl">{item.title}</h3>
              </motion.div>
            </AnimatePresence>
            <p className="mt-5 flex items-center gap-2 text-sm text-[#4a6585]">
              <span className="bg-pale text-brand flex size-8 items-center justify-center rounded-full ring-1 ring-[#d3e8f5]">
                <Hand className="size-4" />
              </span>
              Drag the slider to compare.
            </p>
            <PillCta href="/book" className="mt-8">
              Book a Consultation
            </PillCta>
          </div>

          <div className="lg:col-span-8">
            <BeforeAfterSlider key={item.title} before={item.before} after={item.after} title={item.title} className="shadow-[0_40px_80px_-40px_rgb(8_44_86/0.55)]" />
            <div className="mt-5 flex items-center justify-end gap-4">
              <button
                type="button"
                onClick={() => setActive((i) => Math.max(0, i - 1))}
                disabled={active === 0}
                aria-label="Previous case"
                className="text-brand flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#cfe2f2] bg-white transition-colors hover:bg-pale disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="size-4" />
              </button>
              <span className="tabular text-[#5a7ea8]">
                {String(active + 1).padStart(2, "0")}/{String(BEFORE_AFTER.length).padStart(2, "0")}
              </span>
              <button
                type="button"
                onClick={() => setActive((i) => Math.min(BEFORE_AFTER.length - 1, i + 1))}
                disabled={active === BEFORE_AFTER.length - 1}
                aria-label="Next case"
                className="text-brand flex size-11 cursor-pointer items-center justify-center rounded-full border border-[#cfe2f2] bg-white transition-colors hover:bg-pale disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
