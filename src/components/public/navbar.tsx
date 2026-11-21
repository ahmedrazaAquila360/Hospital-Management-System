"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { PillCta } from "@/components/public/pill-cta";
import { NAV_LINKS } from "@/lib/site-content";
import { cn } from "@/lib/utils";

// Only the landing page opens on a full-bleed hero the navbar can sit on
// without its own surface — every other public page (e.g. /book) gets the
// solid bar immediately.
const TRANSPARENT_HERO_PATHS = ["/"];
const SECTION_IDS = NAV_LINKS.map((link) => link.href.replace("/#", ""));

export function Navbar({ clinicName, isAuthenticated }: { clinicName: string; isAuthenticated: boolean }) {
  const pathname = usePathname();
  const hasTransparentHero = TRANSPARENT_HERO_PATHS.includes(pathname);
  const [scrolled, setScrolled] = useState(!hasTransparentHero);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeId, setActiveId] = useState("home");

  useEffect(() => {
    if (!hasTransparentHero) {
      setScrolled(true);
      return;
    }
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasTransparentHero]);

  // Scroll-spy: highlight whichever section is currently under the reading
  // line so the nav reflects where you actually are on the one-page layout.
  useEffect(() => {
    if (pathname !== "/") return;
    const sections = SECTION_IDS.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-25% 0px -65% 0px", threshold: 0 }
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const solid = scrolled || menuOpen;

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        solid
          ? "border-b border-[#e3edf6] bg-white/85 shadow-[0_8px_30px_-20px_rgb(8_44_86/0.35)] backdrop-blur-xl"
          : "border-b border-transparent bg-white/0"
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 transition-[height] duration-300 sm:px-8",
          solid ? "h-[68px]" : "h-[68px] sm:h-20"
        )}
      >
        <Link href="/#home" className="group rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-cyan/30">
          <BrandLogo
            name={clinicName}
            markClassName="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
            nameClassName="line-clamp-2 max-w-[10rem] text-[15px] leading-[1.1] whitespace-normal!"
          />
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-0.5 xl:flex">
          {NAV_LINKS.map((link) => {
            const id = link.href.replace("/#", "");
            const isActive = pathname === "/" && activeId === id;
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "relative rounded-full px-3.5 py-2 text-[14.5px] font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-4 focus-visible:ring-cyan/30",
                  isActive ? "text-navy" : "text-[#2c4a70] hover:text-brand"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="bg-pale absolute inset-0 rounded-full ring-1 ring-[#d6eaf7]"
                  />
                )}
                <span className="relative">{link.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 xl:flex">
          <Link
            href={isAuthenticated ? "/dashboard" : "/login"}
            className="text-navy hover:text-brand inline-flex items-center gap-1 text-sm font-semibold whitespace-nowrap transition-colors"
          >
            {isAuthenticated ? "Dashboard" : "Staff Login"}
            <ArrowUpRight className="size-3.5 opacity-60" />
          </Link>
          <PillCta href="/book">Book Appointment</PillCta>
        </div>

        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="text-navy flex size-11 items-center justify-center overflow-hidden rounded-xl ring-1 ring-[#dbe8f3] transition-colors hover:bg-pale xl:hidden"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={menuOpen ? "x" : "menu"}
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="flex"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="absolute inset-x-0 top-full max-h-[calc(100svh-68px)] overflow-y-auto border-t border-[#e3edf6] bg-white shadow-[0_24px_40px_-24px_rgb(8_44_86/0.4)] xl:hidden"
          >
            <nav aria-label="Mobile" className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-5 py-4 sm:px-8">
              {NAV_LINKS.map((link, i) => {
                const id = link.href.replace("/#", "");
                const isActive = pathname === "/" && activeId === id;
                return (
                  <motion.a
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className={cn(
                      "rounded-xl px-4 py-3 text-base font-medium transition-colors",
                      isActive ? "bg-pale text-navy" : "text-[#2c4a70] hover:bg-pale hover:text-navy"
                    )}
                  >
                    {link.label}
                  </motion.a>
                );
              })}
              <div className="mt-3 flex flex-col gap-2 border-t border-[#e3edf6] pt-4">
                <Button asChild variant="outline" size="lg" className="rounded-full">
                  <Link href={isAuthenticated ? "/dashboard" : "/login"}>{isAuthenticated ? "Dashboard" : "Staff Login"}</Link>
                </Button>
                <PillCta href="/book" className="justify-center">
                  Book Appointment
                </PillCta>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
