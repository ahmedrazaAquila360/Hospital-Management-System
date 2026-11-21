import Link from "next/link";
import { ArrowUpRight, CalendarDays, Hospital, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Navy brand card summarising today's chair time. Every figure comes straight
 * from the dashboard stats — this only re-presents them.
 */
export function ClinicTodayCard({
  dateLabel,
  total,
  completed,
  pending,
  activeTreatments,
  canOpenChart,
  className,
}: {
  dateLabel: string;
  total: number;
  completed: number;
  pending: number;
  activeTreatments: number;
  canOpenChart: boolean;
  className?: string;
}) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const rows = [
    { label: "Completed today", value: completed, dot: "bg-cyan" },
    { label: "Pending today", value: pending, dot: "bg-[#7fb2e0]" },
    { label: "Active treatments", value: activeTreatments, dot: "bg-white" },
  ];

  return (
    <section
      className={cn(
        "bg-navy-gradient relative isolate flex flex-col overflow-hidden rounded-2xl p-6 text-white shadow-elevated",
        className
      )}
    >
      <div aria-hidden className="absolute -top-24 -right-16 -z-10 size-72 rounded-full bg-cyan/20 blur-3xl" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 opacity-[0.07]"
        style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }}
      />
      <Hospital aria-hidden strokeWidth={1} className="pointer-events-none absolute top-3 -right-4 h-56 w-48 text-cyan/20" />

      <div className="relative max-w-[62%] space-y-2">
        <p className="text-cyan text-[11px] font-semibold tracking-[0.14em] uppercase">Hospital today</p>
        <p className="text-sm text-white/70">{dateLabel}</p>
        <h3 className="font-heading text-2xl leading-tight font-semibold tracking-tight">
          {total === 0 ? "No visits on the books today" : `${completed} of ${total} visits completed`}
        </h3>
      </div>

      <div className="relative mt-6">
        <div className="flex items-center justify-between text-xs text-white/70">
          <span>Today&apos;s schedule</span>
          <span className="font-semibold text-white tabular">{pct}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-white/12"
          role="progressbar"
          aria-label="Today's visits completed"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-linear-to-r from-cyan to-[#8fe6ff]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="relative mt-5 space-y-1 rounded-xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center justify-between gap-3 px-1 py-1 text-sm">
            <span className="flex items-center gap-2 text-white/80">
              <span className={cn("size-2 rounded-full", r.dot)} />
              {r.label}
            </span>
            <span className="font-semibold tabular">{r.value}</span>
          </li>
        ))}
      </ul>

      <div className="relative mt-5 flex flex-wrap gap-2">
        <Link
          href="/appointments?view=day"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-sm font-semibold text-navy transition-colors hover:bg-pale"
        >
          <CalendarDays className="size-4" /> Day schedule
        </Link>
        {canOpenChart && (
          <Link
            href="/opd"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3.5 text-sm font-semibold text-white transition-colors hover:bg-white/15"
          >
            <Stethoscope className="size-4" /> Outpatient queue
            <ArrowUpRight className="size-3.5 opacity-70" />
          </Link>
        )}
      </div>
    </section>
  );
}
