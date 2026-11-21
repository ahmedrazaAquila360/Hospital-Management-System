import type { ReactNode } from "react";
import { ShieldCheck, CalendarCheck2, Activity, Hospital } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-svh flex-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <div className="bg-navy-gradient relative isolate hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-14">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div aria-hidden className="pointer-events-none absolute -top-32 -right-24 -z-10 size-[28rem] rounded-full bg-cyan/20 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 -left-20 -z-10 size-96 rounded-full bg-[#0d4f97]/60 blur-3xl" />

        <BrandLogo name="Hospital Hub" tone="dark" subtitle="Hospital operations" className="relative z-10" />

        <Hospital strokeWidth={1} aria-hidden className="pointer-events-none absolute top-[1%] right-[-12%] h-[44%] w-[38%] text-cyan/20" />

        <div className="relative z-10 max-w-md space-y-8 xl:max-w-lg">
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance xl:text-5xl">
            Hospital staff workspace
          </h1>
          <p className="text-base leading-relaxed text-white/75">
            Register patients, manage beds and document care across hospital departments.
          </p>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan">
                <CalendarCheck2 className="size-4.5" />
              </span>
              Full appointment lifecycle, from booking to check-in
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan">
                <Activity className="size-4.5" />
              </span>
              Consultations, prescriptions and laboratory reports
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] p-3 backdrop-blur-sm">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-cyan">
                <ShieldCheck className="size-4.5" />
              </span>
              Role-based access for every seat on your team
            </li>
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/55">
          © {new Date().getFullYear()} Hospital Hub. All rights reserved.
        </p>
      </div>

      <div className="relative flex flex-col items-center justify-center gap-6 bg-white p-6 md:p-10">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-linear-to-b from-[#eef7fd] to-transparent" />
        <BrandLogo name="Hospital Hub" className="relative lg:hidden" subtitle="Hospital operations" />
        <div className="relative w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
