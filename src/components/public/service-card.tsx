"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Activity,
  AlignCenter,
  Baby,
  Crown,
  Smile,
  Sparkles,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type { Service } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const ICONS = { Stethoscope, Sparkles, Syringe, AlignCenter, Activity, Smile, Crown, Baby } as const;

/**
 * Blue-washed service tile. On wide screens the row expands the hovered (or
 * focused) tile and reveals its description; on small screens the description
 * is always shown.
 */
export function ServiceCard({ service, className }: { service: Service; className?: string }) {
  const Icon = ICONS[service.icon];

  return (
    <Link
      href={`#services`}
      className={cn(
        "group/card relative isolate flex min-h-[340px] overflow-hidden rounded-3xl bg-[#2a6db6] text-white shadow-[0_24px_50px_-30px_rgb(8_44_86/0.7)] outline-none focus-visible:ring-4 focus-visible:ring-cyan/40 lg:min-h-0",
        className
      )}
    >
      <Image
        src={service.image}
        alt={service.title}
        fill
        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 100vw"
        className="-z-20 object-cover opacity-70 mix-blend-luminosity transition-transform duration-700 group-hover/card:scale-105"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(41_120_205/0.35)_0%,rgb(20_88_168/0.55)_55%,rgb(8_44_86/0.9)_100%)]" />
      <div className="absolute inset-0 -z-10 opacity-0 transition-opacity duration-500 group-hover/card:opacity-100 group-focus-visible/card:opacity-100 bg-[radial-gradient(80%_60%_at_30%_20%,rgb(33_188_232/0.35),transparent)]" />

      <div className="flex w-full flex-col justify-between gap-4 p-6">
        <div className="flex items-start justify-between">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-white/25 bg-white/15 backdrop-blur-md">
            <Icon className="size-5" />
          </span>
          <span className="flex size-10 items-center justify-center rounded-full border border-white/25 bg-white/10 backdrop-blur-md transition-transform duration-300 group-hover/card:rotate-45">
            <ArrowUpRight className="size-4" />
          </span>
        </div>

        <div>
          <p className="font-heading text-2xl leading-tight font-semibold tracking-tight text-balance">{service.title}</p>
          <p
            className={cn(
              "mt-3 max-w-sm text-sm leading-relaxed text-white/85",
              "lg:max-h-0 lg:overflow-hidden lg:opacity-0 lg:transition-[max-height,opacity,margin] lg:duration-500",
              "lg:group-hover/card:max-h-32 lg:group-hover/card:opacity-100 lg:group-focus-visible/card:max-h-32 lg:group-focus-visible/card:opacity-100"
            )}
          >
            {service.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
