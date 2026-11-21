import { StaggerGroup, StaggerItem } from "@/components/public/animated-reveal";
import { SectionHeading } from "@/components/public/section-heading";
import { ServiceCard } from "@/components/public/service-card";
import { PillCta } from "@/components/public/pill-cta";
import { SERVICES } from "@/lib/site-content";

// Two rows of four on wide screens; each row grows the tile under the pointer.
const ROWS = [SERVICES.slice(0, 4), SERVICES.slice(4)];

export function Services() {
  return (
    <section id="services" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Our Services"
          title="Complete Dental Care Under One Roof"
          description="From routine checkups to advanced cosmetic treatments, our team handles every stage of your dental health."
          align="center"
        />

        <div className="mt-14 flex flex-col gap-4 lg:gap-5">
          {ROWS.map((row, r) => (
            <StaggerGroup key={r} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:flex lg:h-[400px] lg:gap-5">
              {row.map((service) => (
                <StaggerItem
                  key={service.slug}
                  className="lg:flex-1 lg:transition-[flex-grow] lg:duration-500 lg:ease-[cubic-bezier(0.22,1,0.36,1)] lg:hover:flex-[1.9] lg:has-[:focus-visible]:flex-[1.9]"
                >
                  <ServiceCard service={service} className="h-full" />
                </StaggerItem>
              ))}
            </StaggerGroup>
          ))}
        </div>

        <div className="mt-12 flex justify-center">
          <PillCta href="/book" size="lg">
            Book an Appointment
          </PillCta>
        </div>
      </div>
    </section>
  );
}
