import { SectionHeading } from "@/components/public/section-heading";
import { StaggerGroup, StaggerItem } from "@/components/public/animated-reveal";
import { PATIENT_JOURNEY } from "@/lib/site-content";

export function PatientJourney() {
  return (
    <section className="px-3 py-6 sm:px-5">
      <div className="bg-navy-gradient relative isolate overflow-hidden rounded-[28px] py-20 sm:rounded-[36px] sm:py-24">
        <div aria-hidden className="absolute -top-32 left-1/2 -z-10 size-[36rem] -translate-x-1/2 rounded-full bg-cyan/15 blur-3xl" />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "24px 24px" }}
        />
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <SectionHeading eyebrow="Your Journey" title="From First Visit to Healthy Smile" align="center" light />

          <StaggerGroup className="relative mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div
              aria-hidden
              className="absolute top-7 right-[10%] left-[10%] hidden h-px bg-linear-to-r from-transparent via-cyan/60 to-transparent lg:block"
            />
            {PATIENT_JOURNEY.map((item) => (
              <StaggerItem key={item.step} className="relative">
                <div className="flex h-full flex-col items-center gap-4 rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur-sm transition-colors hover:bg-white/10 lg:border-0 lg:bg-transparent lg:p-2 lg:hover:bg-transparent">
                  <span className="font-heading text-navy relative z-10 flex size-14 items-center justify-center rounded-full bg-white text-base font-semibold shadow-[0_0_0_6px_rgb(33_188_232/0.18),0_14px_30px_-12px_rgb(33_188_232/0.8)]">
                    {item.step}
                  </span>
                  <p className="font-heading text-lg font-semibold tracking-tight text-white">{item.title}</p>
                  <p className="text-sm leading-relaxed text-white/70">{item.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerGroup>
        </div>
      </div>
    </section>
  );
}
