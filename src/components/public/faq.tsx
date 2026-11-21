import { MessageCircleQuestion } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SectionHeading } from "@/components/public/section-heading";
import { AnimatedReveal } from "@/components/public/animated-reveal";
import { PillCta } from "@/components/public/pill-cta";
import { FAQS } from "@/lib/site-content";

export function Faq() {
  return (
    <section className="px-3 py-6 sm:px-5">
      <div className="rounded-[28px] bg-[linear-gradient(180deg,#f2f8fd_0%,#e8f3fb_100%)] py-20 sm:rounded-[36px] sm:py-28">
        <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <SectionHeading eyebrow="FAQ" title="Frequently Asked Questions" />
            <AnimatedReveal delay={0.15}>
              <div className="mt-10 flex max-w-sm items-start gap-4 rounded-3xl border border-white bg-white/80 p-5 shadow-[0_20px_40px_-30px_rgb(8_44_86/0.45)]">
                <span className="bg-brand-gradient flex size-11 shrink-0 items-center justify-center rounded-2xl text-white">
                  <MessageCircleQuestion className="size-5" />
                </span>
                <div>
                  <p className="text-navy text-[15px] leading-snug font-semibold">Choose a time that works for you in under a minute.</p>
                  <PillCta href="/book" className="mt-4">
                    Book Appointment
                  </PillCta>
                </div>
              </div>
            </AnimatedReveal>
          </div>
          <AnimatedReveal delay={0.1} className="lg:col-span-7">
            <Accordion type="single" collapsible className="flex flex-col gap-3">
              {FAQS.map((faq) => (
                <AccordionItem
                  key={faq.question}
                  value={faq.question}
                  className="rounded-2xl border border-white bg-white px-2 shadow-[0_14px_30px_-26px_rgb(8_44_86/0.5)] transition-shadow data-[state=open]:shadow-[0_24px_40px_-28px_rgb(8_44_86/0.55)]"
                >
                  <AccordionTrigger className="text-navy px-4 py-5 text-left text-base font-semibold hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 text-[15px] leading-relaxed text-[#4a6585]">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </AnimatedReveal>
        </div>
      </div>
    </section>
  );
}
