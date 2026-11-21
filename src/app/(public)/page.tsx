import type { Metadata } from "next";
import { siteImage, withTransforms } from "@/lib/cloudinary";
import { Hero } from "@/components/public/hero";
import { AboutDentist } from "@/components/public/about-dentist";
import { Services } from "@/components/public/services";
import { FeaturedTreatment } from "@/components/public/featured-treatment";
import { WhyChooseUs } from "@/components/public/why-choose-us";
import { Technology } from "@/components/public/technology";
import { BeforeAfter } from "@/components/public/before-after";
import { PatientJourney } from "@/components/public/patient-journey";
import { Testimonials } from "@/components/public/testimonials";
import { Faq } from "@/components/public/faq";
import { BlogPreview } from "@/components/public/blog-preview";
import { Cta } from "@/components/public/cta";
import { Contact } from "@/components/public/contact";
import { getClinicSettings } from "@/server/settings/queries";

export const metadata: Metadata = {
  title: "Modern Dental Clinic — Book Your Appointment Online",
  description:
    "Premium, comfortable dental care combining modern technology and a patient-first approach. General dentistry, cosmetic dentistry, implants, orthodontics and more — book your visit online in under a minute.",
  keywords: [
    "dentist",
    "dental clinic",
    "dentist near me",
    "dental treatment",
    "teeth whitening",
    "dental implants",
    "cosmetic dentistry",
    "orthodontics",
    "oral health",
  ],
  openGraph: {
    title: "Modern Dentistry. Healthier Smiles.",
    description:
      "Personalized dental care combining modern technology, clinical expertise and a comfortable patient experience.",
    type: "website",
    images: [withTransforms(siteImage("1667133295315-820bb6481730"), "c_fill,w_1200,h_630,f_jpg,q_auto")],
  },
  twitter: {
    card: "summary_large_image",
    title: "Modern Dentistry. Healthier Smiles.",
    description: "Book your dental appointment online in under a minute.",
  },
};

export default async function LandingPage() {
  const clinic = await getClinicSettings();

  return (
    <>
      <Hero clinicName={clinic.clinicName} />
      <AboutDentist />
      <Services />
      <FeaturedTreatment />
      <WhyChooseUs />
      <Technology />
      <BeforeAfter />
      <PatientJourney />
      <Testimonials />
      <Faq />
      <BlogPreview />
      <Cta clinic={clinic} />
      <Contact clinic={clinic} />
    </>
  );
}
