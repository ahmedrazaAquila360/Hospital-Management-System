import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { SectionHeading } from "@/components/public/section-heading";
import { StaggerGroup, StaggerItem } from "@/components/public/animated-reveal";
import { BLOG_POSTS } from "@/lib/site-content";
import { formatDate } from "@/lib/format";

export function BlogPreview() {
  return (
    <section id="blog" className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <SectionHeading
          eyebrow="Our Blog"
          title="Dental Tips & Insights"
          description="Practical, dentist-reviewed guidance for keeping your smile healthy between visits."
        />
        <StaggerGroup className="mt-14 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <StaggerItem key={post.slug}>
              <article className="group h-full">
                <div className="relative aspect-[16/11] overflow-hidden rounded-[24px] bg-[#e6f2fb]">
                  <Image
                    src={post.image}
                    alt={post.title}
                    fill
                    sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgb(8_44_86/0.45)_100%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                  <span className="text-navy absolute top-4 left-4 rounded-full bg-white/85 px-3 py-1 text-xs font-semibold backdrop-blur">
                    {post.category}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 px-1 pt-5">
                  <time dateTime={post.date} className="text-xs font-medium text-[#5a7ea8]">
                    {formatDate(post.date)}
                  </time>
                  <p className="font-heading text-navy text-xl leading-snug font-semibold tracking-tight text-balance">{post.title}</p>
                  <p className="line-clamp-2 text-[15px] leading-relaxed text-[#4a6585]">{post.excerpt}</p>
                  <span className="text-brand mt-1 inline-flex items-center gap-1.5 text-sm font-semibold">
                    Read Article
                    <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </span>
                </div>
              </article>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </div>
    </section>
  );
}
