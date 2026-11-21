"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/public/section-heading";
import { TECHNOLOGY } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export function Technology() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [atEnd, setAtEnd] = useState(false);

  // Track which card is leftmost so the counter and arrows stay in sync with
  // free scrolling (touch, trackpad) as well as the buttons.
  const sync = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const left = track.scrollLeft;
    let nearest = 0;
    cards.forEach((card, i) => {
      if (Math.abs(card.offsetLeft - track.offsetLeft - left) < Math.abs(cards[nearest].offsetLeft - track.offsetLeft - left)) nearest = i;
    });
    setIndex(nearest);
    setAtEnd(left + track.clientWidth >= track.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", sync, { passive: true });
    const resize = new ResizeObserver(sync);
    resize.observe(track);
    return () => {
      track.removeEventListener("scroll", sync);
      resize.disconnect();
    };
  }, [sync]);

  function go(delta: number) {
    const track = trackRef.current;
    if (!track) return;
    const cards = Array.from(track.children) as HTMLElement[];
    const next = Math.min(cards.length - 1, Math.max(0, index + delta));
    track.scrollTo({ left: cards[next].offsetLeft - track.offsetLeft, behavior: "smooth" });
  }

  return (
    <section id="technology" className="overflow-hidden py-20 sm:py-28">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.6fr)] lg:gap-12">
        <div className="flex flex-col justify-between gap-8">
          <SectionHeading eyebrow="Our Technology" title="Modern Technology. Better Dental Care." />
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={index === 0}
              aria-label="Previous technology"
              className="text-brand flex size-12 cursor-pointer items-center justify-center rounded-full border border-[#cfe2f2] bg-white transition-colors hover:bg-pale disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowLeft className="size-4.5" />
            </button>
            <span className="text-[#5a7ea8] tabular text-lg font-medium" aria-live="polite">
              {String(index + 1).padStart(2, "0")}/{String(TECHNOLOGY.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={index === TECHNOLOGY.length - 1 || atEnd}
              aria-label="Next technology"
              className="text-brand flex size-12 cursor-pointer items-center justify-center rounded-full border border-[#cfe2f2] bg-white transition-colors hover:bg-pale disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="size-4.5" />
            </button>
          </div>
        </div>

        <div
          ref={trackRef}
          className="no-scrollbar -mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-4 sm:-mx-8 sm:px-8 lg:mx-0 lg:px-0"
        >
          {TECHNOLOGY.map((tech, i) => (
            <article
              key={tech.title}
              className={cn(
                "group w-[78%] shrink-0 snap-start rounded-[26px] bg-[#2f6db5] p-3 text-white shadow-[0_30px_60px_-34px_rgb(8_44_86/0.8)] transition-transform duration-500 hover:-translate-y-1 sm:w-[46%] lg:w-[40%]",
                i % 2 === 1 && "bg-[#285fa2]"
              )}
            >
              <div className="relative aspect-[4/4.4] overflow-hidden rounded-[20px] bg-[#e6f2fb]">
                <Image
                  src={tech.image}
                  alt={tech.title}
                  fill
                  sizes="(min-width: 1024px) 26vw, 70vw"
                  className="object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <span className="text-navy absolute top-3 left-3 rounded-full bg-white/85 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </div>
              <div className="px-2 pt-5 pb-3">
                <p className="font-heading text-2xl font-semibold tracking-tight">{tech.title}</p>
                <p className="mt-1.5 text-sm text-white/75">{tech.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
