/**
 * Central content/config for the public marketing site (src/app/(public)).
 * Swap copy, stats, and images here — components should not hardcode any of it.
 *
 * Photography: free-to-use Unsplash photos (Unsplash License — no attribution
 * required), selected for dental/clinical relevance and re-hosted on the clinic's
 * Cloudinary account (see src/lib/cloudinary.ts). To add or change a photo, use
 * siteImage("<unsplash photo id>") and run `node --env-file=.env.local
 * scripts/upload-site-images.mjs`. Replace with real clinic photography before
 * using this as an actual practice's live site.
 */
import { siteImage } from "@/lib/cloudinary";

export const SITE_IMAGES = {
  hero: siteImage("1667133295315-820bb6481730"),
  aboutDentist: siteImage("1674734198544-dc8dda539076"),
  featuredTreatment: siteImage("1677026010083-78ec7f1b84ed"),
  ctaBackground: siteImage("1489278353717-f64c6ee8a4d2"),
} as const;

export const NAV_LINKS = [
  { label: "Home", href: "/#home" },
  { label: "About", href: "/#about" },
  { label: "Services", href: "/#services" },
  { label: "Why Us", href: "/#why-us" },
  { label: "Treatments", href: "/#technology" },
  { label: "Testimonials", href: "/#testimonials" },
  { label: "Blog", href: "/#blog" },
  { label: "Contact", href: "/#contact" },
] as const;

export const HERO_BADGES = [
  { label: "15+ Years Experience" },
  { label: "5,000+ Happy Patients" },
  { label: "Advanced Dental Care" },
] as const;

export const STATS = [
  { value: 10, suffix: "+", label: "Years Experience" },
  { value: 5000, suffix: "+", label: "Happy Patients" },
  { value: 15, suffix: "+", label: "Dental Treatments" },
  { value: 98, suffix: "%", label: "Patient Satisfaction" },
] as const;

export const ABOUT_CREDENTIALS = [
  { icon: "BadgeCheck", label: "Certified Dentist" },
  { icon: "Cpu", label: "Modern Technology" },
  { icon: "HeartHandshake", label: "Patient-Centered Care" },
] as const;

export type Service = {
  slug: string;
  icon: "Stethoscope" | "Sparkles" | "Syringe" | "AlignCenter" | "Activity" | "Smile" | "Crown" | "Baby";
  title: string;
  description: string;
  image: string;
};

export const SERVICES: Service[] = [
  {
    slug: "general-dentistry",
    icon: "Stethoscope",
    title: "General Dentistry",
    description: "Routine examinations, cleaning and preventive care to keep your whole family smiling.",
    image: siteImage("1606811971618-4486d14f3f99"),
  },
  {
    slug: "teeth-whitening",
    icon: "Sparkles",
    title: "Teeth Whitening",
    description: "Professional whitening treatments for a noticeably brighter, more confident smile.",
    image: siteImage("1564420228450-d9a5bc8d6565"),
  },
  {
    slug: "dental-implants",
    icon: "Activity",
    title: "Dental Implants",
    description: "Durable, natural-looking solutions for missing teeth using modern implant technology.",
    image: siteImage("1593022356769-11f762e25ed9"),
  },
  {
    slug: "orthodontics",
    icon: "AlignCenter",
    title: "Orthodontics",
    description: "Braces and clear aligner options to gently guide your teeth into perfect alignment.",
    image: siteImage("1598256989809-394fa4f6cd26"),
  },
  {
    slug: "root-canal",
    icon: "Syringe",
    title: "Root Canal Treatment",
    description: "Comfortable, precise treatment for damaged or infected teeth using modern techniques.",
    image: siteImage("1606811856475-5e6fcdc6e509"),
  },
  {
    slug: "cosmetic-dentistry",
    icon: "Smile",
    title: "Cosmetic Dentistry",
    description: "Smile makeovers and aesthetic treatments tailored to how you want to look and feel.",
    image: siteImage("1677026010083-78ec7f1b84ed"),
  },
  {
    slug: "dental-crowns",
    icon: "Crown",
    title: "Dental Crowns",
    description: "Custom-fitted crowns that restore strength and shape to damaged or weakened teeth.",
    image: siteImage("1588776814546-1ffcf47267a5"),
  },
  {
    slug: "pediatric-dentistry",
    icon: "Baby",
    title: "Pediatric Dentistry",
    description: "Friendly, gentle dental care that helps children build healthy habits early on.",
    image: siteImage("1629909613654-28e377c37b09"),
  },
];

export const WHY_CHOOSE_US = [
  { icon: "GraduationCap", title: "Experienced Dentists", description: "Our clinicians bring years of hands-on expertise to every visit." },
  { icon: "Cpu", title: "Advanced Technology", description: "Digital imaging and modern equipment for precise, efficient care." },
  { icon: "Sofa", title: "Comfortable Environment", description: "A calm, welcoming space designed to ease dental anxiety." },
  { icon: "UserCheck", title: "Personalized Treatment", description: "Every treatment plan is tailored to your specific needs." },
  { icon: "ReceiptText", title: "Transparent Pricing", description: "Clear costs up front — no surprises after your visit." },
  { icon: "HeartHandshake", title: "Patient-First Approach", description: "Your comfort and questions always come before the clock." },
] as const;

export const TECHNOLOGY = [
  { title: "Digital X-Rays", description: "Lower radiation, instant results.", image: siteImage("1588776814546-1ffcf47267a5") },
  { title: "3D Dental Imaging", description: "Precise treatment planning.", image: siteImage("1600170311833-c2cf5280ce49") },
  { title: "Digital Scanning", description: "Comfortable, impression-free scans.", image: siteImage("1667133295315-820bb6481730") },
  { title: "Modern Equipment", description: "Efficient, precise treatment tools.", image: siteImage("1598256989800-fe5f95da9787") },
  { title: "Sterilization Technology", description: "Hospital-grade safety standards.", image: siteImage("1606811841689-23dfddce3e95") },
] as const;

export const BEFORE_AFTER = [
  {
    title: "Teeth Whitening",
    before: siteImage("1598256989809-394fa4f6cd26"),
    after: siteImage("1677026010083-78ec7f1b84ed"),
  },
  {
    title: "Cosmetic Dentistry",
    before: siteImage("1564420228450-d9a5bc8d6565"),
    after: siteImage("1489278353717-f64c6ee8a4d2"),
  },
] as const;

export const PATIENT_JOURNEY = [
  { step: "01", title: "Book Appointment", description: "Choose a time that works for you in under a minute." },
  { step: "02", title: "Meet Your Dentist", description: "A friendly consultation to understand your needs." },
  { step: "03", title: "Get Your Treatment Plan", description: "A clear, personalized plan with transparent pricing." },
  { step: "04", title: "Start Your Treatment", description: "Comfortable care using modern techniques." },
  { step: "05", title: "Enjoy Your Healthy Smile", description: "Ongoing support to keep your smile at its best." },
] as const;

export type Testimonial = {
  name: string;
  treatment: string;
  rating: number;
  review: string;
  avatar: string;
};

// Sample/demo testimonials — structured for easy swap with real patient reviews.
export const TESTIMONIALS: Testimonial[] = [
  {
    name: "Amara Chen",
    treatment: "Teeth Whitening",
    rating: 5,
    review: "The whole visit felt calm and unhurried. My smile is noticeably brighter and the team explained every step.",
    avatar: siteImage("1489278353717-f64c6ee8a4d2"),
  },
  {
    name: "Daniel Ortiz",
    treatment: "Dental Implants",
    rating: 5,
    review: "I was nervous about implants but the process was far more comfortable than I expected. Great results.",
    avatar: siteImage("1667133295308-9ef24f71952e"),
  },
  {
    name: "Priya Sharma",
    treatment: "Orthodontics",
    rating: 5,
    review: "Clear, honest advice on aligners vs. braces, and the technology they use made planning really easy.",
    avatar: siteImage("1494790108377-be9c29b29330"),
  },
  {
    name: "Marcus Webb",
    treatment: "General Checkup",
    rating: 5,
    review: "Booking online took thirty seconds and the front desk confirmed within the hour. Painless, in every sense.",
    avatar: siteImage("1548382131-e0ebb1f0cdea"),
  },
] as const;

export const FAQS = [
  { question: "How do I book an appointment?", answer: "Use the \"Book Appointment\" button anywhere on this site to submit a request — our front desk will confirm your exact time by phone or email, usually within one business day." },
  { question: "What should I bring to my first visit?", answer: "A photo ID, your insurance details if applicable, and a list of any current medications or past dental records you have." },
  { question: "Do you provide emergency dental care?", answer: "Yes — mention \"urgent\" or \"emergency\" in your booking request and our team will prioritize a same-week slot where possible." },
  { question: "How long does teeth whitening take?", answer: "A typical in-clinic whitening session takes 60–90 minutes, with results visible immediately after treatment." },
  { question: "Do you treat children?", answer: "Yes, our pediatric dentistry services are designed to make young patients' visits comfortable and even fun." },
  { question: "Do you offer orthodontic treatment?", answer: "We offer both traditional braces and clear aligner options — your dentist will recommend the best fit during a consultation." },
  { question: "How often should I visit a dentist?", answer: "We generally recommend a checkup and cleaning every six months, though your dentist may suggest a different interval based on your oral health." },
] as const;

export type BlogPost = {
  slug: string;
  category: string;
  date: string;
  title: string;
  excerpt: string;
  image: string;
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "7-ways-to-keep-teeth-healthy",
    category: "Oral Health",
    date: "2026-06-02",
    title: "7 Ways to Keep Your Teeth Healthy",
    excerpt: "Simple daily habits — beyond brushing twice a day — that make a real difference to your long-term oral health.",
    image: siteImage("1606811971618-4486d14f3f99"),
  },
  {
    slug: "how-often-should-you-visit-a-dentist",
    category: "Preventive Care",
    date: "2026-05-18",
    title: "How Often Should You Visit a Dentist?",
    excerpt: "The six-month rule isn't one-size-fits-all — here's how your dentist decides the right checkup schedule for you.",
    image: siteImage("1598256989800-fe5f95da9787"),
  },
  {
    slug: "what-causes-tooth-sensitivity",
    category: "Dental Health",
    date: "2026-04-27",
    title: "What Causes Tooth Sensitivity?",
    excerpt: "From enamel wear to gum recession — common causes of sensitive teeth and what actually helps.",
    image: siteImage("1593022356769-11f762e25ed9"),
  },
  {
    slug: "professional-vs-home-whitening",
    category: "Cosmetic Dentistry",
    date: "2026-04-10",
    title: "Professional vs. Home Teeth Whitening",
    excerpt: "How in-clinic whitening compares to over-the-counter kits on results, safety, and how long it lasts.",
    image: siteImage("1564420228450-d9a5bc8d6565"),
  },
  {
    slug: "when-do-you-need-a-root-canal",
    category: "Treatments",
    date: "2026-03-22",
    title: "When Do You Need a Root Canal?",
    excerpt: "The warning signs of a damaged or infected tooth, and why root canal treatment is more comfortable than its reputation.",
    image: siteImage("1667133295352-ef4c83620e8e"),
  },
  {
    slug: "caring-for-teeth-after-treatment",
    category: "Recovery",
    date: "2026-03-05",
    title: "How to Care for Your Teeth After Treatment",
    excerpt: "Practical aftercare tips to protect your results, whether you've just had a filling, whitening, or implant work.",
    image: siteImage("1629909613654-28e377c37b09"),
  },
];

export const SOCIAL_LINKS = [
  { label: "Instagram", href: "#" },
  { label: "Facebook", href: "#" },
  { label: "YouTube", href: "#" },
] as const;
