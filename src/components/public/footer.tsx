import Link from "next/link";
import { Camera, Play, Users } from "lucide-react";
import { BrandLogo, BrandMark } from "@/components/brand/brand-logo";
import { NAV_LINKS, SOCIAL_LINKS } from "@/lib/site-content";
import type { getClinicSettings } from "@/server/settings/queries";

const SERVICE_LINKS = [
  "General Dentistry",
  "Cosmetic Dentistry",
  "Dental Implants",
  "Orthodontics",
  "Teeth Whitening",
];

// lucide-react dropped brand/logo icons — these are close generic stand-ins
// (camera / people / play) for demo social links, not literal brand marks.
const SOCIAL_ICONS = { Instagram: Camera, Facebook: Users, YouTube: Play } as const;

export function Footer({ clinic }: { clinic: Awaited<ReturnType<typeof getClinicSettings>> }) {
  return (
    <footer className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#3f7cc4_0%,#2c66ad_45%,#1d4f92_100%)] text-white">
      <BrandMark tone="dark" className="pointer-events-none absolute -bottom-24 -left-16 -z-10 size-96 opacity-[0.12]" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.06]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
      />

      <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 pt-16 pb-12 sm:px-8 lg:grid-cols-12 lg:pt-20">
        <div className="lg:col-span-4">
          <Link href="/#home" className="inline-block">
            <BrandLogo name={clinic.clinicName} tone="dark" markClassName="size-11" />
          </Link>
          <p className="mt-5 max-w-xs text-[15px] leading-relaxed text-white/75">
            Modern, comfortable dental care — from routine checkups to complete smile transformations.
          </p>
          <div className="mt-6 flex gap-2">
            {SOCIAL_LINKS.map((s) => {
              const Icon = SOCIAL_ICONS[s.label as keyof typeof SOCIAL_ICONS];
              return (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  className="flex size-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <Icon className="size-4" />
                </a>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 lg:col-span-8">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">Navigation</p>
            <ul className="mt-5 space-y-3 text-[15px] text-white/85">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-white hover:underline hover:underline-offset-4">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">Services</p>
            <ul className="mt-5 space-y-3 text-[15px] text-white/85">
              {SERVICE_LINKS.map((s) => (
                <li key={s}>
                  <a href="#services" className="transition-colors hover:text-white hover:underline hover:underline-offset-4">
                    {s}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">Contact Us</p>
            <ul className="mt-5 space-y-3 text-[15px] text-white/85">
              {clinic.phone && <li>{clinic.phone}</li>}
              {clinic.email && <li className="break-words">{clinic.email}</li>}
              {clinic.address && <li>{clinic.address}</li>}
            </ul>
            <p className="mt-8 text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">Visit Hours</p>
            <p className="mt-3 text-[15px] text-white/85">Mon–Fri 9am–6pm · Sat 10am–2pm</p>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="border-t border-white/15 py-6 text-center text-xs text-white/65 sm:text-left">
          © {new Date().getFullYear()} {clinic.clinicName}. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
