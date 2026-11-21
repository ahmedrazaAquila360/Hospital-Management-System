import type { Metadata } from "next";
import { CalendarCheck2, MailCheck, Smile } from "lucide-react";
import { BookingForm } from "@/components/public/booking-form";
import { GlassToothIllustration } from "@/components/brand/glass-tooth-illustration";
import { getDentists } from "@/server/appointments/queries";

export const metadata: Metadata = { title: "Book Appointment" };

// Mirrors the steps described in the site's FAQ and the form's own note.
const STEPS = [
  { icon: CalendarCheck2, title: "Send your request", text: "Choose a time that works for you in under a minute." },
  { icon: MailCheck, title: "We confirm your time", text: "Our front desk confirms your exact appointment time by phone or email." },
  { icon: Smile, title: "Visit the clinic", text: "A friendly consultation to understand your needs." },
];

export default async function BookPage() {
  const dentists = await getDentists();

  return (
    <div className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute -top-40 left-1/2 -z-10 size-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,#e3f3fc_0%,transparent_65%)]" />

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-8 sm:py-16 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
        <aside className="bg-navy-gradient relative isolate flex flex-col overflow-hidden rounded-[28px] p-7 text-white sm:p-10">
          <div aria-hidden className="absolute -top-24 -right-20 -z-10 size-72 rounded-full bg-cyan/25 blur-3xl" />
          <GlassToothIllustration className="animate-float pointer-events-none absolute top-8 -right-8 -z-10 hidden w-36 opacity-80 sm:block lg:w-40" />

          <span className="text-cyan text-xs font-semibold tracking-[0.18em] uppercase">Consultation</span>
          <h1 className="mt-4 max-w-[15ch] text-4xl leading-[1.04] font-semibold tracking-[-0.035em] sm:text-5xl">Book Your Appointment</h1>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-white/75">
            Tell us a bit about your visit and we&apos;ll take it from there.
          </p>

          <ol className="mt-10 space-y-3 lg:mt-auto lg:pt-12">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex max-w-sm items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                <span className="text-cyan flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <step.icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">
                    <span className="text-white/50 tabular">{String(i + 1).padStart(2, "0")} · </span>
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-sm text-white/70">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </aside>

        <div className="flex flex-col justify-center">
          <BookingForm dentists={dentists.map((d) => ({ id: d.id, name: d.name }))} />
        </div>
      </div>
    </div>
  );
}
