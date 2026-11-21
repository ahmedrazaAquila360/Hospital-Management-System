import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarCheck2,
  CircleDollarSign,
  HandCoins,
  Receipt,
  Stethoscope,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { resolveRange, RANGE_LABEL, type ReportRange } from "@/lib/reports";
import {
  getAppointmentReport,
  getFinancialReport,
  getPatientReport,
  getTreatmentReport,
} from "@/server/reports/queries";
import { getClinicSettings } from "@/server/settings/queries";
import { ReportsToolbar } from "@/components/reports/reports-toolbar";
import { PrintReportButton } from "@/components/reports/print-button";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { BrandMark } from "@/components/brand/brand-logo";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

type SearchParams = Promise<{ range?: string; from?: string; to?: string }>;

export default async function ReportsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("reports.view");
  const params = await searchParams;
  const range = (["today", "week", "month", "year", "custom"].includes(params.range ?? "") ? params.range : "month") as ReportRange;
  const { start, end } = resolveRange(range, params.from, params.to);

  const [patients, appointments, financial, treatments, clinic] = await Promise.all([
    getPatientReport(start, end),
    getAppointmentReport(start, end),
    getFinancialReport(start, end),
    getTreatmentReport(start, end),
    getClinicSettings(),
  ]);
  const period = `${formatDate(start)} – ${formatDate(end)}`;
  const generatedAt = formatDateTime(new Date());
  const otherAppointments = Math.max(0, appointments.total - appointments.completed - appointments.cancelled - appointments.noShow);
  const maxTreatment = Math.max(1, ...treatments.mostCommon.map((t) => t.count));
  const maxMoney = Math.max(1, financial.revenue, financial.expenses);

  return (
    <>
      {/* ---------- Screen ---------- */}
      <div className="flex flex-col gap-6 print:hidden">
        <PageHeader
          icon={<BarChart3 />}
          title="Reports & Analytics"
          description={
            <>
              {RANGE_LABEL[range]} · {period}
            </>
          }
          actions={<PrintReportButton />}
        />

        <ReportsToolbar range={range} from={params.from} to={params.to} />
        <section className="surface-card p-5"><h3 className="font-semibold">Collected revenue by service</h3>
          {financial.serviceRevenue.length ? financial.serviceRevenue.map(row=><p className="flex justify-between border-b py-2" key={row.category}><span>{row.category}</span><span>{formatCurrency(row.revenue,clinic.currency)}</span></p>) : <p>No payments in this period.</p>}</section>

        <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
          <StatCard icon={HandCoins} value={formatCurrency(financial.revenue)} label="Revenue (payments)" tone="success" />
          <StatCard icon={Wallet} value={formatCurrency(financial.expenses)} label="Expenses" tone="destructive" />
          <StatCard
            icon={financial.netIncome >= 0 ? TrendingUp : TrendingDown}
            value={formatCurrency(financial.netIncome)}
            label="Net Income"
            tone={financial.netIncome >= 0 ? "success" : "destructive"}
          />
          <StatCard icon={Receipt} value={formatCurrency(financial.outstanding)} label="Outstanding" tone={financial.outstanding > 0 ? "warning" : "brand"} />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel icon={CircleDollarSign} title="Financial Report">
            <div className="space-y-4">
              <Bar label="Revenue" value={financial.revenue} max={maxMoney} display={formatCurrency(financial.revenue)} className="bg-success" />
              <Bar label="Expenses" value={financial.expenses} max={maxMoney} display={formatCurrency(financial.expenses)} className="bg-destructive" />
            </div>
            <MetricRow
              items={[
                { label: "Payments recorded", value: financial.paymentsCount },
                { label: "Net income", value: formatCurrency(financial.netIncome), tone: financial.netIncome >= 0 ? "success" : "destructive" },
                { label: "Outstanding (all invoices)", value: formatCurrency(financial.outstanding), tone: financial.outstanding > 0 ? "destructive" : undefined },
              ]}
            />
          </Panel>

          <Panel icon={CalendarCheck2} title="Appointment Report">
            <div>
              <div className="bg-muted flex h-3 overflow-hidden rounded-full" aria-hidden>
                {appointments.total > 0 &&
                  [
                    [appointments.completed, "bg-success"],
                    [appointments.cancelled, "bg-destructive"],
                    [appointments.noShow, "bg-warning"],
                    [otherAppointments, "bg-brand/50"],
                  ].map(([v, c], i) => (
                    <span key={i} className={c as string} style={{ width: `${((v as number) / appointments.total) * 100}%` }} />
                  ))}
              </div>
              <p className="text-muted-foreground mt-2 text-xs">
                {appointments.total} appointment{appointments.total === 1 ? "" : "s"} in this period
                {otherAppointments > 0 && ` · ${otherAppointments} not yet completed or closed`}
              </p>
            </div>
            <MetricRow
              items={[
                { label: "Completed", value: appointments.completed, tone: "success", dot: "bg-success" },
                { label: "Cancelled", value: appointments.cancelled, tone: "destructive", dot: "bg-destructive" },
                { label: "No-show", value: appointments.noShow, tone: "destructive", dot: "bg-warning" },
                { label: "Upcoming after period", value: appointments.upcoming },
              ]}
            />
          </Panel>

          <Panel icon={Users} title="Patient Report">
            <MetricRow
              items={[
                { label: "Total patients", value: patients.total },
                { label: "New in period", value: patients.newPatients, tone: "success" },
                { label: "Returning in period", value: patients.returningPatients },
              ]}
            />
          </Panel>

          <Panel icon={Stethoscope} title="Treatment Report">
            <MetricRow
              items={[
                { label: "Treatment value", value: formatCurrency(treatments.revenue), tone: "success" },
                { label: "Completed", value: treatments.completed },
                { label: "Planned / in progress", value: treatments.pending },
              ]}
            />
            {treatments.mostCommon.length > 0 ? (
              <div className="space-y-2.5">
                <p className="text-muted-foreground text-xs font-medium">Most common treatments</p>
                {treatments.mostCommon.map((t) => (
                  <Bar key={t.name} label={t.name} value={t.count} max={maxTreatment} display={String(t.count)} className="bg-brand-gradient" />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground bg-muted/40 rounded-xl px-3 py-4 text-center text-sm">No treatments recorded in this period.</p>
            )}
          </Panel>
        </div>
      </div>

      {/* ---------- Print / Save as PDF (A4) ---------- */}
      <div className="hidden text-[11pt] text-slate-900 print:block">
        <div className="flex items-start justify-between border-b-2 border-[#0875ba] pb-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-12" />
            <div>
              <p className="text-2xl font-bold text-[#073b7a]">{clinic.clinicName}</p>
              <p className="text-sm text-slate-500">DentalHub Clinic Suite</p>
            </div>
          </div>
          {/* Only details saved in Settings → Clinic; nothing invented. */}
          <div className="text-right text-sm leading-relaxed text-slate-600">
            {clinic.address && <p>{clinic.address}</p>}
            {clinic.phone && <p>{clinic.phone}</p>}
            {clinic.email && <p>{clinic.email}</p>}
          </div>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold text-[#073b7a]">Clinic Report</p>
            <p className="text-slate-500">Patient, appointment, financial and treatment summary</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-right text-sm">
            <p>
              <span className="text-slate-500">Period:</span> <strong>{period}</strong> ({RANGE_LABEL[range]})
            </p>
            <p>
              <span className="text-slate-500">Generated:</span> {generatedAt}
            </p>
          </div>
        </div>

        <PrintSection title="Financial Report">
          <PrintTable
            rows={[
              ["Revenue (payments received)", formatCurrency(financial.revenue)],
              ["Payments recorded", String(financial.paymentsCount)],
              ["Expenses", formatCurrency(financial.expenses)],
              ["Net income", formatCurrency(financial.netIncome)],
              ["Outstanding balance (all unpaid invoices)", formatCurrency(financial.outstanding)],
            ]}
          />
        </PrintSection>
        <PrintSection title="Appointment Report">
          <PrintTable
            rows={[
              ["Appointments in period", String(appointments.total)],
              ["Completed", String(appointments.completed)],
              ["Cancelled", String(appointments.cancelled)],
              ["No-show", String(appointments.noShow)],
              ["Upcoming after period (scheduled / confirmed)", String(appointments.upcoming)],
            ]}
          />
        </PrintSection>
        <PrintSection title="Patient Report">
          <PrintTable
            rows={[
              ["Total patients", String(patients.total)],
              ["New patients in period", String(patients.newPatients)],
              ["Returning patients in period", String(patients.returningPatients)],
            ]}
          />
        </PrintSection>
        <PrintSection title="Treatment Report">
          <PrintTable
            rows={[
              ["Treatment value", formatCurrency(treatments.revenue)],
              ["Completed", String(treatments.completed)],
              ["Planned / in progress", String(treatments.pending)],
            ]}
          />
          {treatments.mostCommon.length > 0 && (
            <>
              <p className="mt-4 mb-2 text-sm font-semibold text-slate-600">Most common treatments</p>
              <PrintTable head={["Treatment", "Count"]} rows={treatments.mostCommon.map((t) => [t.name, String(t.count)])} />
            </>
          )}
        </PrintSection>

        <div className="mt-8 flex justify-between border-t border-slate-200 pt-3 text-xs text-slate-500">
          <span>{clinic.clinicName} · Clinic Report</span>
          <span>{period}</span>
        </div>
      </div>
    </>
  );
}

function Panel({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="surface-card flex flex-col gap-5 p-5 sm:p-6">
      <h3 className="text-navy flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span className="bg-pale text-brand flex size-9 items-center justify-center rounded-xl" aria-hidden>
          <Icon className="size-[1.1rem]" />
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function MetricRow({
  items,
}: {
  items: { label: string; value: string | number; tone?: "success" | "destructive"; dot?: string }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))]">
      {items.map((m) => (
        <div key={m.label} className="bg-muted/40 flex flex-col rounded-xl p-3">
          <dt className="text-muted-foreground order-last mt-1 flex items-center gap-1.5 text-xs">
            {m.dot && <span className={cn("size-2 rounded-full", m.dot)} aria-hidden />}
            {m.label}
          </dt>
          <dd
            className={cn(
              "font-heading text-xl font-semibold tabular-nums",
              m.tone === "success" ? "text-success" : m.tone === "destructive" ? "text-destructive" : "text-navy"
            )}
          >
            {m.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Bar({ label, value, max, display, className }: { label: string; value: number; max: number; display: string; className: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="text-foreground/80 truncate">{label}</span>
      <span className="bg-muted h-2.5 overflow-hidden rounded-full" aria-hidden>
        <span className={cn("block h-full rounded-full", className)} style={{ width: `${Math.max(value > 0 ? 2 : 0, (value / max) * 100)}%` }} />
      </span>
      <span className="text-navy min-w-12 text-right font-semibold tabular-nums">{display}</span>
    </div>
  );
}

function PrintSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-7 break-inside-avoid">
      <p className="mb-2 text-lg font-bold text-[#073b7a]">{title}</p>
      {children}
    </section>
  );
}

function PrintTable({ rows, head }: { rows: string[][]; head?: string[] }) {
  return (
    <table className="w-full border-collapse overflow-hidden rounded-lg text-sm">
      {head && (
        <thead>
          <tr className="bg-[#073b7a] text-left text-white">
            {head.map((h, i) => (
              <th key={h} className={cn("px-3 py-2 font-semibold", i > 0 && "text-right")}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
      )}
      <tbody>
        {rows.map(([label, value], i) => (
          <tr key={label} className={i % 2 ? "bg-slate-50" : "bg-white"}>
            <td className="border-b border-slate-200 px-3 py-2">{label}</td>
            <td className="border-b border-slate-200 px-3 py-2 text-right font-semibold tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
