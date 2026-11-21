import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { AnimatedReveal } from "@/components/public/animated-reveal";
import { SectionHeading } from "@/components/public/section-heading";
import { PillCta } from "@/components/public/pill-cta";
import type { getClinicSettings } from "@/server/settings/queries";
import { WEEK_DAYS, formatShifts, parseWorkingHours } from "@/lib/working-hours";


export function Contact({ clinic }: { clinic: Awaited<ReturnType<typeof getClinicSettings>> }) {
  const hours = parseWorkingHours(clinic.workingHours);

  const details = [
    { icon: MapPin, label: "Address", value: clinic.address ?? "Address available on request" },
    { icon: Phone, label: "Phone", value: clinic.phone ?? "—" },
    { icon: Mail, label: "Email", value: clinic.email ?? "—" },
  ];

  return (
    <section id="contact" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading eyebrow="Contact" title="Visit or Reach Out to Us" />

        <div className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-5">
          <AnimatedReveal direction="left" className="lg:col-span-2">
            <div className="flex h-full flex-col gap-3">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-4 rounded-2xl border border-[#e3edf6] bg-[#f7fbfe] p-5">
                  <span className="bg-brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold tracking-[0.12em] text-[#5a7ea8] uppercase">{label}</p>
                    <p className="text-navy mt-1 text-[15px] font-medium break-words">{value}</p>
                  </div>
                </div>
              ))}
              <div className="flex items-start gap-4 rounded-2xl border border-[#e3edf6] bg-[#f7fbfe] p-5">
                <span className="bg-brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow">
                  <Clock className="size-5" />
                </span>
                <div className="flex-1">
                  <p className="text-xs font-semibold tracking-[0.12em] text-[#5a7ea8] uppercase">Opening Hours</p>
                  {hours ? (
                    <ul className="text-navy mt-2 space-y-1 text-sm">
                      {WEEK_DAYS.map(({ key, label }) => (
                        <li key={key} className="flex justify-between gap-4">
                          <span className="text-[#4a6585]">{label}</span>
                          <span className="text-right font-medium">{formatShifts(hours[key])}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-navy mt-1 text-sm font-medium">Mon–Fri 9am–6pm · Sat 10am–2pm</p>
                  )}
                </div>
              </div>
              <PillCta href="/book" size="lg" className="mt-2 w-fit">
                Book Appointment
              </PillCta>
            </div>
          </AnimatedReveal>

          <AnimatedReveal direction="right" className="lg:col-span-3">
            <div className="bg-navy-gradient relative isolate flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-[28px] lg:aspect-auto lg:h-full">
              <div
                aria-hidden
                className="absolute inset-0 -z-10 opacity-[0.16]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgb(255 255 255 / 0.5) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.5) 1px, transparent 1px)",
                  backgroundSize: "36px 36px",
                }}
              />
              <div aria-hidden className="absolute top-1/2 left-1/2 -z-10 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan/25 blur-3xl" />
              <div className="relative flex flex-col items-center gap-3 px-6 text-center">
                <span className="relative flex size-16 items-center justify-center rounded-full bg-white text-brand shadow-[0_0_0_10px_rgb(255_255_255/0.12),0_0_0_22px_rgb(255_255_255/0.06)]">
                  <MapPin className="size-7" />
                </span>
                <p className="font-heading mt-3 text-xl font-semibold text-white">{clinic.clinicName}</p>
                <p className="max-w-xs text-sm text-white/70">
                  Map preview — connect a Google Maps embed with your clinic&apos;s real address to replace this placeholder.
                </p>
              </div>
            </div>
          </AnimatedReveal>
        </div>
      </div>
    </section>
  );
}
