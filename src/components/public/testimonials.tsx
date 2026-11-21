"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Quote, Star } from "lucide-react";
import { SectionHeading } from "@/components/public/section-heading";
import { TESTIMONIALS } from "@/lib/site-content";
import { cn } from "@/lib/utils";

function visibleCount() {
  if (typeof window === "undefined") return 1;
  return window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1;
}

export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [perView, setPerView] = useState(1);

  useEffect(() => {
    function update() {
      setPerView(visibleCount());
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const maxIndex = Math.max(0, TESTIMONIALS.length - perView);

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i >= maxIndex ? 0 : i + 1));
    }, 5000);
    return () => clearInterval(id);
  }, [maxIndex]);

  return (
    <section id="testimonials" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <SectionHeading eyebrow="Testimonials" title="What Our Patients Say" />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label="Previous testimonials"
              className="text-brand flex size-12 cursor-pointer items-center justify-center rounded-full border border-[#cfe2f2] bg-white transition-colors hover:bg-pale disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="size-4.5" />
            </button>
            <span className="tabular text-lg font-medium text-[#5a7ea8]">
              {String(index + 1).padStart(2, "0")}/{String(maxIndex + 1).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(maxIndex, i + 1))}
              disabled={index === maxIndex}
              aria-label="Next testimonials"
              className="text-brand flex size-12 cursor-pointer items-center justify-center rounded-full border border-[#cfe2f2] bg-white transition-colors hover:bg-pale disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="size-4.5" />
            </button>
          </div>
        </div>

        <div className="mt-12 overflow-hidden">
          <motion.div
            className="flex gap-6"
            animate={{ x: `-${index * (100 / perView)}%` }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            {TESTIMONIALS.map((t, i) => (
              <div key={t.name} className="shrink-0" style={{ width: `calc(${100 / perView}% - ${(6 * (perView - 1)) / perView}rem)` }}>
                <figure
                  className={cn(
                    "relative flex h-full flex-col gap-5 overflow-hidden rounded-[26px] p-7 transition-transform duration-300 hover:-translate-y-1",
                    i % 3 === 1
                      ? "bg-navy-gradient text-white shadow-[0_30px_60px_-34px_rgb(8_44_86/0.8)]"
                      : "border border-[#e3edf6] bg-[#f7fbfe] shadow-[0_20px_40px_-34px_rgb(8_44_86/0.5)]"
                  )}
                >
                  <Quote className={cn("absolute top-6 right-6 size-12", i % 3 === 1 ? "text-white/10" : "text-[#d9eaf6]")} />
                  <div className="flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                    {Array.from({ length: t.rating }).map((_, s) => (
                      <Star key={s} className="size-4 fill-[#f5b744] text-[#f5b744]" />
                    ))}
                  </div>
                  <blockquote className={cn("flex-1 text-[17px] leading-relaxed", i % 3 === 1 ? "text-white/90" : "text-[#26446b]")}>
                    &ldquo;{t.review}&rdquo;
                  </blockquote>
                  <figcaption className={cn("flex items-center gap-3 border-t pt-5", i % 3 === 1 ? "border-white/15" : "border-[#e3edf6]")}>
                    <div className="relative size-11 shrink-0 overflow-hidden rounded-full ring-2 ring-white">
                      <Image src={t.avatar} alt={t.name} fill sizes="44px" className="object-cover" />
                    </div>
                    <div>
                      <p className={cn("text-sm font-semibold", i % 3 === 1 ? "text-white" : "text-navy")}>{t.name}</p>
                      <p className={cn("text-xs", i % 3 === 1 ? "text-cyan" : "text-brand")}>{t.treatment}</p>
                    </div>
                  </figcaption>
                </figure>
              </div>
            ))}
          </motion.div>
        </div>

        <div className="mt-8 flex justify-center gap-1.5">
          {Array.from({ length: maxIndex + 1 }).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`h-1.5 cursor-pointer rounded-full transition-all ${i === index ? "bg-brand w-8" : "w-1.5 bg-[#cfe2f2]"}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
