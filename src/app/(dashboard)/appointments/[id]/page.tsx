import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CalendarCheck2,
  CalendarDays,
  Check,
  CircleSlash,
  ClipboardList,
  Clock3,
  FileText,
  History,
  Layers,
  NotebookPen,
  Pencil,
  Pill,
  Stethoscope,
  UserRound,
  UserX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { getAppointmentById } from "@/server/appointments/queries";
import { getWorkingHours } from "@/server/settings/queries";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/shared/back-link";
import { StatusBadge } from "@/components/shared/status-badge";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import { TreatmentStatusPill } from "@/components/treatments/treatments-table";
import { AppointmentQuickActions } from "@/components/appointments/appointment-quick-actions";
import { RescheduleDialog } from "@/components/appointments/reschedule-dialog";
import { canReschedule, STATUS_VERBS } from "@/lib/appointment-status";
import { formatDate, formatDateTime, formatTime, initialsFromName } from "@/lib/format";
import { APPOINTMENT_STATUS_TONE } from "@/lib/status";
import { APPOINTMENT_TYPE_LABEL } from "@/lib/labels";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Appointment Details" };

/** HH:mm on the server's clock: the same clock the booking action used to save the time. */
function clockTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default async function AppointmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("appointments.view");
  const { id } = await params;
  const [appointment, activity, workingHours] = await Promise.all([
    getAppointmentById(id),
    prisma.activityLog.findMany({
      where: { entityType: "Appointment", entityId: id },
      orderBy: { createdAt: "asc" },
      select: { id: true, action: true, description: true, metadata: true, createdAt: true, user: { select: { name: true } } },
    }),
    getWorkingHours(),
  ]);
  if (!appointment || (user.role.name === "DENTIST" && appointment.dentistId !== user.id)) notFound();

  const canEdit = can(user, "appointments.edit");
  const patientId = appointment.patientId;
  const dateKey = appointment.date.toISOString().slice(0, 10);
  const timeline = buildTimeline(appointment, activity);

  const quickActions: { href: string; label: string; icon: LucideIcon | typeof ToothIcon; show: boolean }[] = [
    { href: `/patients/${patientId}`, label: "Patient Profile", icon: UserRound, show: can(user, "patients.view") },
    { href: `/dental-chart?patientId=${patientId}`, label: "Dental Chart", icon: ToothIcon, show: can(user, "dental_chart.view") },
    {
      href: `/treatments/new?patientId=${patientId}&appointmentId=${appointment.id}`,
      label: "New Treatment",
      icon: Stethoscope,
      show: can(user, "treatments.create"),
    },
    {
      href: `/prescriptions/new?patientId=${patientId}&appointmentId=${appointment.id}`,
      label: "New Prescription",
      icon: Pill,
      show: can(user, "prescriptions.create"),
    },
    { href: `/billing/invoices/new?patientId=${patientId}`, label: "New Invoice", icon: FileText, show: can(user, "billing.create") },
    { href: `/appointments?view=day&date=${dateKey}`, label: "Day Schedule", icon: CalendarDays, show: true },
  ];
  const visibleActions = quickActions.filter((a) => a.show);

  const treatments = can(user, "treatments.view") ? appointment.treatments : [];
  const prescriptions = can(user, "prescriptions.view") ? appointment.prescriptions : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
      <BackLink href="/appointments" label="Back to Appointments" />

      {appointment.encounter && <p>OPD token #{appointment.encounter.token} {can(user,"opd.view") && <Link className="text-brand underline" href={`/opd?visit=${appointment.encounter.id}`}>Open consultation</Link>}</p>}

      {/* Patient overview */}
      <section className="surface-card relative overflow-hidden p-5 sm:p-6">
        <HeaderBackdrop />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <Avatar className="size-16 shrink-0 shadow-sm ring-4 ring-white sm:size-[5.25rem]">
              {appointment.patient.photoUrl && <AvatarImage src={appointment.patient.photoUrl} alt={appointment.patient.fullName} />}
              <AvatarFallback className="bg-pale text-brand text-xl font-semibold sm:text-2xl">
                {initialsFromName(appointment.patient.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-navy truncate text-xl font-semibold tracking-tight sm:text-[1.65rem]">
                  {can(user, "patients.view") ? (
                    <Link href={`/patients/${patientId}`} className="hover:text-brand transition-colors">
                      {appointment.patient.fullName}
                    </Link>
                  ) : (
                    appointment.patient.fullName
                  )}
                </h2>
                <Badge variant="outline" className="bg-white/70 font-mono text-[11px] font-medium">
                  {appointment.patient.patientCode}
                </Badge>
              </div>
              <div className="text-foreground/80 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.95rem]">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays className="text-muted-foreground size-[1.1rem]" aria-hidden />
                  {formatDate(appointment.date)}
                </span>
                <span className="inline-flex items-center gap-2 tabular-nums">
                  <Clock3 className="text-muted-foreground size-[1.1rem]" aria-hidden />
                  {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
                </span>
                <StatusBadge
                  status={appointment.status}
                  tone={APPOINTMENT_STATUS_TONE[appointment.status]}
                  className="rounded-full px-2.5 py-0.5 text-[0.8rem]"
                />
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2.5">
              {canReschedule(appointment.status) && (
                <RescheduleDialog
                  id={appointment.id}
                  patientName={appointment.patient.fullName}
                  date={dateKey}
                  startTime={clockTime(appointment.startTime)}
                  endTime={clockTime(appointment.endTime)}
                  status={appointment.status}
                  workingHours={workingHours}
                />
              )}
              <Button asChild variant="outline" size="lg" className="rounded-full bg-white px-5 shadow-xs">
                <Link href={`/appointments/${appointment.id}/edit`}>
                  <Pencil className="text-brand" /> Edit
                </Link>
              </Button>
              <AppointmentQuickActions
                id={appointment.id}
                status={appointment.status}
                patientName={appointment.patient.fullName}
                variant="header"
              />
            </div>
          )}
        </div>
      </section>

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1fr)_26rem]">
        {/* Visit details */}
        <section className="surface-card flex flex-col p-5 sm:p-6">
          <SectionTitle icon={ClipboardList} title="Visit Details" />
          <dl className="grid sm:grid-cols-2 sm:gap-x-8">
            <Detail icon={UserRound} label="Dentist">
              {appointment.dentist.name}
            </Detail>
            <Detail icon={Layers} label="Type">
              {APPOINTMENT_TYPE_LABEL[appointment.type] ?? appointment.type}
            </Detail>
            <Detail icon={CalendarCheck2} label="Booked by" className="sm:border-b-0">
              {appointment.createdBy?.name ?? <Muted>Not recorded</Muted>}
            </Detail>
            <Detail icon={NotebookPen} label="Notes" className="border-b-0">
              {appointment.notes ? (
                <span className="font-medium whitespace-pre-line">{appointment.notes}</span>
              ) : (
                <Muted>—</Muted>
              )}
            </Detail>
          </dl>

          {(treatments.length > 0 || prescriptions.length > 0) && (
            <div className="border-border/70 mt-2 border-t pt-5">
              <p className="text-muted-foreground mb-3 text-xs font-semibold tracking-wide uppercase">Recorded during this visit</p>
              <ul className="grid gap-2 md:grid-cols-2">
                {treatments.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/treatments/${t.id}`}
                      className="border-border/70 hover:border-brand/40 hover:bg-pale/50 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
                    >
                      <span className="bg-pale text-brand flex size-9 shrink-0 items-center justify-center rounded-lg" aria-hidden>
                        <Stethoscope className="size-4" />
                      </span>
                      <span className="text-navy min-w-0 flex-1 truncate text-sm font-semibold" title={t.name}>
                        {t.name}
                      </span>
                      <TreatmentStatusPill status={t.status} />
                    </Link>
                  </li>
                ))}
                {prescriptions.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/prescriptions/${p.id}`}
                      className="border-border/70 hover:border-brand/40 hover:bg-pale/50 flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
                    >
                      <span className="bg-pale text-brand flex size-9 shrink-0 items-center justify-center rounded-lg" aria-hidden>
                        <Pill className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="text-navy block truncate text-sm font-semibold">Prescription · {formatDate(p.date)}</span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {p.medicines.length ? p.medicines.map((m) => m.medicineName).join(", ") : "No medicines listed"}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Timeline */}
        <section className="surface-card p-5 sm:p-6">
          <SectionTitle icon={History} title="Appointment Timeline" />
          <ol className="pt-1">
            {timeline.map((step, i) => {
              const next = timeline[i + 1];
              const reached = step.state !== "upcoming";
              return (
                <li key={step.key} className="relative flex gap-4 pb-5 last:pb-0">
                  {next && (
                    <span
                      className={cn(
                        "absolute top-8 bottom-0 left-[0.9375rem] w-0.5 -translate-x-1/2 rounded-full",
                        next.state !== "upcoming" ? "bg-brand/70" : "bg-border"
                      )}
                      aria-hidden
                    />
                  )}
                  <StepMarker state={step.state} />
                  <div className="min-w-0 pt-0.5">
                    <p className={cn("font-semibold", reached ? "text-navy" : "text-foreground/70")}>{step.title}</p>
                    <p className={cn("text-sm tabular-nums", step.when ? "text-foreground/75" : "text-muted-foreground")}>
                      {step.when ?? (reached ? "Time not recorded" : "—")}
                    </p>
                    {step.note && <p className="text-muted-foreground mt-0.5 text-xs">{step.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </div>

      {/* Continue the visit */}
      <section className="surface-card p-5 sm:p-6">
        <SectionTitle icon={Zap} title="Continue the Visit" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {visibleActions.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="group border-border/80 text-navy hover:border-brand/50 hover:bg-pale hover:text-brand focus-visible:ring-ring/60 flex min-h-28 flex-col items-center justify-center gap-3 rounded-2xl border bg-white px-3 py-5 text-center shadow-xs transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2"
            >
              <a.icon className="size-7 transition-transform group-hover:scale-105" aria-hidden />
              <span className="text-[0.95rem] font-semibold">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ----------------------------------------------------------------------------------------- */

type StepState = "done" | "current" | "upcoming" | "cancelled" | "no_show";
type Step = { key: string; title: string; state: StepState; when: string | null; note?: string | null };

type Appointment = NonNullable<Awaited<ReturnType<typeof getAppointmentById>>>;
type Activity = { action: string; description: string | null; metadata: unknown; createdAt: Date; user: { name: string } | null };

const FLOW: AppointmentStatus[] = ["SCHEDULED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED"];
const STEP_TITLE: Record<AppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked In",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  NO_SHOW: "No-show",
};
// Longest verbs first so "marked as no-show" wins over shorter matches.
const VERB_TO_STATUS = (Object.entries(STATUS_VERBS) as [AppointmentStatus, string][]).sort((a, b) => b[1].length - a[1].length);

const meta = (m: unknown) => (m && typeof m === "object" ? (m as Record<string, unknown>) : {});

/** The status a STATUS_CHANGE entry moved to: from its metadata, or the verb in older entries. */
function statusOf(log: Activity): AppointmentStatus | null {
  const to = meta(log.metadata).to;
  if (typeof to === "string" && to in STATUS_VERBS) return to as AppointmentStatus;
  const text = log.description ?? "";
  return VERB_TO_STATUS.find(([, verb]) => text.includes(` ${verb} the appointment`))?.[0] ?? null;
}

const stamp = (d: Date) => `${formatDate(d)} · ${formatTime(d)}`;
const byLine = (log: Activity) => (log.user?.name ? `by ${log.user.name}` : null);

/**
 * Builds the timeline only from what's stored: when it was booked (createdAt), the slot itself,
 * and the activity log's status changes and reschedules. Steps the visit hasn't reached show "—";
 * a reached step with no log entry (older data) says the time wasn't recorded.
 */
function buildTimeline(appointment: Appointment, activity: Activity[]): Step[] {
  // A no-show booked again starts the visit flow over; only count changes after that.
  const reopenedAt = [...activity].reverse().find((a) => a.action === "UPDATE" && meta(meta(a.metadata).status).to === "SCHEDULED")?.createdAt;
  const cycle = reopenedAt ? activity.filter((a) => a.createdAt >= reopenedAt) : activity;
  const changes = cycle.flatMap((a) => (a.action === "STATUS_CHANGE" ? [{ status: statusOf(a), log: a }] : []));
  const lastChange = (s: AppointmentStatus) => [...changes].reverse().find((c) => c.status === s)?.log;
  const reschedules = activity.filter(
    (a) => a.action === "UPDATE" && (meta(a.metadata).kind === "reschedule" || (!meta(a.metadata).kind && a.description?.includes(" rescheduled ")))
  );
  const lastReschedule = reschedules.at(-1);

  const status = appointment.status;
  const terminal = status === "CANCELLED" || status === "NO_SHOW";
  // Every status the visit is known to have had: where each change went, and (newer entries)
  // where it came from — so a visit confirmed before logging began still shows as confirmed.
  const seen = new Set<AppointmentStatus>(
    changes.flatMap((c) => {
      const from = meta(c.log.metadata).from;
      return [c.status, typeof from === "string" && from in STATUS_VERBS ? (from as AppointmentStatus) : null].filter(
        (s): s is AppointmentStatus => s !== null
      );
    })
  );
  const reachedIdx = terminal ? Math.max(0, ...[...seen].map((s) => FLOW.indexOf(s))) : FLOW.indexOf(status);

  const booked = activity.find((a) => a.action === "CREATE");
  const steps: Step[] = [
    {
      key: "booked",
      title: "Booked",
      state: "done",
      when: stamp(appointment.createdAt),
      note: appointment.createdBy?.name ? `by ${appointment.createdBy.name}` : booked ? byLine(booked) : null,
    },
    {
      key: "SCHEDULED",
      title: "Scheduled",
      state: reachedIdx === 0 && !terminal ? "current" : "done",
      when: stamp(appointment.startTime),
      note: lastReschedule
        ? `Rescheduled ${formatDateTime(lastReschedule.createdAt)}${lastReschedule.user?.name ? ` by ${lastReschedule.user.name}` : ""}${reopenedAt ? " after a no-show" : ""}`
        : null,
    },
  ];

  FLOW.slice(1).forEach((s, offset) => {
    const idx = offset + 1;
    const log = lastChange(s);
    // Confirmation is optional: shown while it can still happen or once it did.
    if (s === "CONFIRMED" && !seen.has("CONFIRMED") && !(status === "SCHEDULED" || status === "CONFIRMED")) return;
    if (terminal && idx > reachedIdx) return;
    const state: StepState = idx < reachedIdx ? "done" : idx === reachedIdx ? (s === "COMPLETED" || terminal ? "done" : "current") : "upcoming";
    steps.push({ key: s, title: STEP_TITLE[s], state, when: log ? stamp(log.createdAt) : null, note: log ? byLine(log) : null });
  });

  if (terminal) {
    const log = lastChange(status);
    steps.push({
      key: status,
      title: STEP_TITLE[status],
      state: status === "CANCELLED" ? "cancelled" : "no_show",
      when: log ? stamp(log.createdAt) : null,
      note: log ? byLine(log) : null,
    });
  }
  return steps;
}

function StepMarker({ state }: { state: StepState }) {
  const base = "relative z-[1] flex size-[1.875rem] shrink-0 items-center justify-center rounded-full";
  if (state === "upcoming") return <span className={cn(base, "border-2 border-[#cfd9e3] bg-white")} aria-hidden />;
  if (state === "cancelled")
    return (
      <span className={cn(base, "bg-destructive text-white ring-4 ring-[#fdedef]")} aria-hidden>
        <CircleSlash className="size-4" strokeWidth={2.5} />
      </span>
    );
  if (state === "no_show")
    return (
      <span className={cn(base, "bg-amber-500 text-white ring-4 ring-amber-50")} aria-hidden>
        <UserX className="size-4" strokeWidth={2.5} />
      </span>
    );
  return (
    <span className={cn(base, "text-white", state === "current" ? "bg-brand ring-pale ring-4" : "bg-success")} aria-hidden>
      <Check className="size-4" strokeWidth={3} />
    </span>
  );
}

function HeaderBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div
        className="absolute inset-y-0 right-0 w-full sm:w-3/4"
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, transparent 34%, rgba(205,229,244,0.32) 34%, rgba(205,229,244,0.32) 52%, transparent 52%), linear-gradient(115deg, transparent 0%, transparent 58%, rgba(205,229,244,0.42) 58%, rgba(205,229,244,0.42) 76%, transparent 76%), radial-gradient(120% 140% at 100% 0%, rgba(227,243,252,0.95) 0%, rgba(241,248,253,0.6) 45%, transparent 75%)",
        }}
      />
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <h3 className="text-navy border-border/70 mb-2 flex items-center gap-3 border-b pb-4 text-lg font-semibold tracking-tight">
      <span className="bg-pale text-brand flex size-9 items-center justify-center rounded-full" aria-hidden>
        <Icon className="size-[1.1rem]" />
      </span>
      {title}
    </h3>
  );
}

function Detail({ icon: Icon, label, children, className }: { icon: LucideIcon; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("border-border/70 flex min-w-0 items-start gap-3.5 border-b py-4", className)}>
      <span className="bg-pale text-brand flex size-11 shrink-0 items-center justify-center rounded-full" aria-hidden>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 pt-0.5">
        <dt className="text-muted-foreground text-sm">{label}</dt>
        <dd className="text-navy mt-0.5 text-[1.05rem] font-semibold break-words">{children}</dd>
      </div>
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground font-normal">{children}</span>;
}
