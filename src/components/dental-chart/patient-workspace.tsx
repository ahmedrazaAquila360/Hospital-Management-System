import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarCheck2,
  CalendarPlus,
  ChevronRight,
  Eye,
  FilePlus2,
  Grid3x3,
  Pill,
  Plus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/page-header";
import { ListFooter } from "@/components/shared/list-footer";
import { DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/lib/pagination";
import { GlassTooth } from "@/components/brand/glass-tooth";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import {
  ClearSearchButton,
  PatientListControls,
  PatientSearchField,
  PatientWorkspaceProvider,
  PendingRegion,
} from "@/components/dental-chart/patient-picker";
import { can, type PermissionKey, type SessionUser } from "@/lib/permissions";
import { formatDate, initialsFromName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDentistOptions, listPatients, type PatientListFilters } from "@/server/patients/queries";
import { getDashboardStats } from "@/server/dashboard/queries";
import type { Gender } from "@/generated/prisma/enums";

export type PatientWorkspaceParams = {
  search?: string;
  gender?: string;
  dentistId?: string;
  sort?: string;
  page?: string;
  perPage?: string;
  layout?: string;
};

const SORTS = ["name_asc", "name_desc", "recent", "oldest"] as const;
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

type Row = {
  id: string;
  fullName: string;
  patientCode: string;
  phone: string;
  photoUrl: string | null;
  lastVisit: Date | null;
};

const chartHref = (id: string) => `/dental-chart?patientId=${id}`;

/**
 * Patient picker for the dental chart: search, filter, sort and paginate patients with
 * the same server query as the Patients page (`listPatients`), plus permission-aware
 * shortcuts and clinic counts from the dashboard query. Only the fields shown here are
 * read from each row, so balances and the like never reach this page.
 */
export async function PatientWorkspace({ user, params }: { user: SessionUser; params: PatientWorkspaceParams }) {
  // Sanitise URL input: an unknown gender would otherwise reach Prisma as an invalid enum.
  const sort = SORTS.find((s) => s === params.sort) ?? "name_asc";
  const gender = GENDERS.find((g) => g === params.gender) as Gender | undefined;
  const dentistId = params.dentistId || undefined;
  const search = params.search?.trim() || undefined;
  const requestedPage = parsePage(params.page);
  const layout = params.layout === "grid" ? "grid" : "list";

  const filters: PatientListFilters = { search, gender, dentistId, sort, page: requestedPage, pageSize: parsePageSize(params.perPage) };
  const [dentistUsers, list, stats] = await Promise.all([getDentistOptions(), listPatients(filters), getDashboardStats()]);
  // getDentistOptions returns whole User rows (password hash included): pass only what the
  // client filter needs.
  const dentists = dentistUsers.map((d) => ({ id: d.id, name: d.name }));
  const rows: Row[] = list.rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    patientCode: r.patientCode,
    phone: r.phone,
    photoUrl: r.photoUrl,
    lastVisit: r.lastVisit,
  }));
  const filtered = Boolean(search || gender || dentistId);
  const canViewPatients = can(user, "patients.view");

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    if (gender) sp.set("gender", gender);
    if (dentistId) sp.set("dentistId", dentistId);
    if (sort !== "name_asc") sp.set("sort", sort);
    if (layout === "grid") sp.set("layout", "grid");
    if (list.pageSize !== DEFAULT_PAGE_SIZE) sp.set("perPage", String(list.pageSize));
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    return qs ? `/dental-chart?${qs}` : "/dental-chart";
  }

  return (
    <PatientWorkspaceProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          icon={<ToothIcon />}
          title="Dental Chart"
          description="View and manage patients' dental charts, conditions and treatments."
          actions={
            can(user, "patients.create") && (
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/patients/new">
                  <Plus /> Add Patient
                </Link>
              </Button>
            )
          }
        />

        {/* overflow-clip, not overflow-hidden: a hidden-overflow box is still scrollable, and
            focusing the search scrolled the hero itself, cutting off the badge and the tooth. */}
        <section className="bg-navy-gradient shadow-elevated relative isolate overflow-clip rounded-3xl px-6 py-8 text-white sm:px-10 sm:py-10">
          <div aria-hidden className="bg-cyan/25 absolute -top-24 right-24 -z-10 size-80 rounded-full blur-3xl" />
          <div aria-hidden className="absolute -right-16 -bottom-24 -z-10 size-96 rounded-full bg-[#0d6fbf]/40 blur-3xl" />
          <div
            aria-hidden
            className="pointer-events-none absolute top-1/2 right-6 hidden h-24 w-80 -translate-y-1/2 -rotate-6 rounded-[50%] border-2 border-cyan-300/50 shadow-[0_0_24px_rgb(79_208_243/0.45)] lg:block xl:right-16"
          />
          <GlassTooth
            tone="dark"
            className="pointer-events-none absolute top-1/2 right-16 hidden h-64 w-56 -translate-y-1/2 md:block xl:right-28"
          />
          <div className="relative max-w-xl space-y-3 md:max-w-[min(36rem,60%)]">
            <span className="text-cyan inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] uppercase ring-1 ring-white/15">
              <Grid3x3 className="size-3.5" aria-hidden /> Clinical workspace
            </span>
            <h3 className="font-heading text-3xl leading-tight font-semibold tracking-tight sm:text-[2.1rem]">
              Select a patient
            </h3>
            <p className="text-sm leading-relaxed text-white/75 sm:text-[0.95rem]">
              Search for a patient to view their dental chart, treatment history and notes.
            </p>
            <div className="pt-2">
              <PatientSearchField />
            </div>
          </div>
        </section>

        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_21rem]">
          <section className="surface-card @container min-w-0 overflow-hidden" aria-labelledby="chart-patients-heading">
            <header className="flex flex-col gap-3 px-5 pt-5 pb-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2.5">
                <h3 id="chart-patients-heading" className="font-heading text-navy text-xl font-semibold tracking-tight">
                  Patients
                </h3>
                <span className="bg-pale text-navy rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums">
                  {list.total} {filtered ? (list.total === 1 ? "result" : "results") : list.total === 1 ? "patient" : "patients"}
                </span>
              </div>
              <PatientListControls
                sort={sort}
                gender={gender}
                dentistId={dentistId}
                layout={layout}
                dentists={dentists}
              />
            </header>

            <PendingRegion>
              {rows.length === 0 ? (
                <Empty className="w-auto border-border/70 mx-5 mb-5 rounded-2xl border border-dashed py-12 sm:mx-6">
                  <EmptyMedia variant="icon">
                    <Users />
                  </EmptyMedia>
                  <EmptyTitle>{filtered ? "No patients match" : list.total ? "No patients on this page" : "No patients yet"}</EmptyTitle>
                  <EmptyDescription>
                    {filtered
                      ? "Try a different name, patient ID or phone number, or clear the filters."
                      : list.total
                        ? "This page is past the end of the list."
                        : "Add your first patient to start charting."}
                  </EmptyDescription>
                  <EmptyContent>
                    {filtered ? (
                      <ClearSearchButton />
                    ) : list.total ? (
                      <Button asChild variant="outline">
                        <Link href={buildHref(1)}>Back to the first page</Link>
                      </Button>
                    ) : null}
                  </EmptyContent>
                </Empty>
              ) : layout === "grid" ? (
                <PatientGrid rows={rows} canViewPatients={canViewPatients} />
              ) : (
                <PatientRows rows={rows} canViewPatients={canViewPatients} />
              )}

              <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={rows.length} noun="patient" />
            </PendingRegion>
          </section>

          <aside className="grid gap-6 md:grid-cols-2 xl:grid-cols-1">
            <QuickActions user={user} />
            <ClinicInsights
              items={[
                { icon: Users, label: "Total patients", value: stats.totalPatients },
                { icon: UserPlus, label: "New this month", value: stats.newPatientsThisMonth },
                { icon: Activity, label: "Active treatments", value: stats.activeTreatments },
                { icon: CalendarCheck2, label: "Appointments today", value: stats.todayAppointments },
              ]}
            />
          </aside>
        </div>
      </div>
    </PatientWorkspaceProvider>
  );
}

function PatientAvatar({ row, className }: { row: Row; className?: string }) {
  return (
    <Avatar className={cn("size-10 ring-2 ring-white", className)}>
      {row.photoUrl && <AvatarImage src={row.photoUrl} alt="" className="object-cover" />}
      <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold text-navy">
        {initialsFromName(row.fullName)}
      </AvatarFallback>
    </Avatar>
  );
}

function RowActions({ row, canViewPatients }: { row: Row; canViewPatients: boolean }) {
  return (
    <div className="relative z-10 flex items-center gap-1.5">
      {canViewPatients && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground hover:text-navy size-9 rounded-xl">
              <Link href={`/patients/${row.id}`} aria-label={`View ${row.fullName}'s profile`}>
                <Eye />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>View profile</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="bg-pale text-brand hover:bg-brand size-9 rounded-xl hover:text-white">
            <Link href={chartHref(row.id)} aria-label={`Open ${row.fullName}'s dental chart`}>
              <ToothIcon className="size-[1.1rem]" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Open dental chart</TooltipContent>
      </Tooltip>
    </div>
  );
}

const ROW_GRID = "@2xl:grid-cols-[minmax(0,1.7fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_5.5rem]";

/** Table-style rows; the patient name is a stretched link, so the whole row opens the chart. */
function PatientRows({ rows, canViewPatients }: { rows: Row[]; canViewPatients: boolean }) {
  return (
    <div className="px-2 pb-2 sm:px-3">
      <div
        aria-hidden
        className={cn(
          "text-muted-foreground bg-muted/50 hidden items-center gap-4 rounded-xl px-4 py-2.5 text-xs font-semibold @2xl:grid",
          ROW_GRID
        )}
      >
        <span>Patient</span>
        <span>Patient ID</span>
        <span>Phone</span>
        <span>Last Visit</span>
        <span className="text-right">Actions</span>
      </div>
      <ul className="divide-border/60 divide-y">
        {rows.map((row) => (
          <li
            key={row.id}
            className={cn(
              "group hover:bg-pale/60 focus-within:bg-pale/60 relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3 transition-colors @2xl:px-4",
              ROW_GRID
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <PatientAvatar row={row} />
              <div className="min-w-0">
                <Link
                  href={chartHref(row.id)}
                  className="text-navy group-hover:text-primary block truncate text-sm font-semibold outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
                >
                  {row.fullName}
                </Link>
                <p className="text-muted-foreground flex flex-wrap gap-x-1.5 text-xs leading-snug @2xl:hidden">
                  <span className="whitespace-nowrap tabular-nums">{row.patientCode}</span>
                  <span aria-hidden>·</span>
                  <span className="whitespace-nowrap tabular-nums">{row.phone}</span>
                </p>
                {row.lastVisit && (
                  <p className="text-muted-foreground text-xs leading-snug @2xl:hidden">Last visit {formatDate(row.lastVisit)}</p>
                )}
              </div>
            </div>
            <span title={row.patientCode} className="text-foreground/80 hidden truncate text-sm tabular-nums @2xl:block">{row.patientCode}</span>
            <span title={row.phone} className="text-foreground/80 hidden truncate text-sm tabular-nums @2xl:block">{row.phone}</span>
            <span className="text-foreground/80 hidden text-sm whitespace-nowrap @2xl:block">
              {row.lastVisit ? formatDate(row.lastVisit) : <span className="text-muted-foreground">No visits yet</span>}
            </span>
            <div className="flex justify-end">
              <RowActions row={row} canViewPatients={canViewPatients} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PatientGrid({ rows, canViewPatients }: { rows: Row[]; canViewPatients: boolean }) {
  return (
    <ul className="grid gap-3 px-5 pb-5 sm:px-6 @lg:grid-cols-2 @5xl:grid-cols-3">
      {rows.map((row) => (
        <li
          key={row.id}
          className="group border-border/80 hover:border-brand/30 hover:bg-pale/40 relative flex flex-col gap-4 rounded-2xl border p-4 transition-colors"
        >
          <div className="flex items-center gap-3">
            <PatientAvatar row={row} className="size-12" />
            <div className="min-w-0">
              <Link
                href={chartHref(row.id)}
                className="text-navy group-hover:text-primary block truncate font-semibold outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-ring/60"
              >
                {row.fullName}
              </Link>
              <p className="text-muted-foreground text-xs tabular-nums">{row.patientCode}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div className="min-w-0">
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-foreground/85 mt-0.5 truncate font-medium tabular-nums">{row.phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Last visit</dt>
              <dd className="text-foreground/85 mt-0.5 font-medium">{row.lastVisit ? formatDate(row.lastVisit) : "—"}</dd>
            </div>
          </dl>
          <div className="border-border/70 flex items-center justify-between border-t pt-3">
            <span className="text-brand inline-flex items-center gap-1 text-xs font-semibold">
              Open chart <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
            <RowActions row={row} canViewPatients={canViewPatients} />
          </div>
        </li>
      ))}
    </ul>
  );
}

const QUICK_ACTIONS: { href: string; permission: PermissionKey; icon: LucideIcon; title: string; hint: string }[] = [
  { href: "/treatments/new", permission: "treatments.create", icon: FilePlus2, title: "Add Treatment", hint: "Record a treatment" },
  { href: "/appointments/new", permission: "appointments.create", icon: CalendarPlus, title: "New Appointment", hint: "Schedule a visit" },
  { href: "/prescriptions/new", permission: "prescriptions.create", icon: Pill, title: "New Prescription", hint: "Write a prescription" },
  { href: "/reports", permission: "reports.view", icon: BarChart3, title: "View Reports", hint: "Clinic and treatment data" },
];

/** Shortcuts to existing pages, shown only to users allowed to open them. */
function QuickActions({ user }: { user: SessionUser }) {
  const actions = QUICK_ACTIONS.filter((a) => can(user, a.permission));
  if (actions.length === 0) return null;
  return (
    <SideCard title="Quick Actions">
      <div className="grid grid-cols-2 gap-3">
        {actions.map(({ href, icon: Icon, title, hint }) => (
          <Link
            key={href}
            href={href}
            className="group border-border/80 hover:border-brand/30 hover:bg-pale/50 focus-visible:ring-ring/60 flex flex-col gap-2.5 rounded-2xl border p-3.5 transition-colors outline-none focus-visible:ring-2"
          >
            <span className="bg-pale text-brand group-hover:bg-brand flex size-9 items-center justify-center rounded-xl transition-colors group-hover:text-white">
              <Icon className="size-[1.1rem]" aria-hidden />
            </span>
            <span>
              <span className="text-navy block text-sm leading-tight font-semibold">{title}</span>
              <span className="text-muted-foreground mt-0.5 block text-xs">{hint}</span>
            </span>
          </Link>
        ))}
      </div>
    </SideCard>
  );
}

function ClinicInsights({ items }: { items: { icon: LucideIcon; label: string; value: number }[] }) {
  return (
    <SideCard title="Clinic Insights" description="Live counts across the clinic">
      <dl className="grid grid-cols-2 gap-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-muted/40 flex flex-col rounded-2xl p-3.5">
            <Icon className="text-brand size-[1.1rem]" aria-hidden />
            <dt className="text-muted-foreground order-last mt-1 text-xs">{label}</dt>
            <dd className="font-heading text-navy mt-2 text-2xl leading-none font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </SideCard>
  );
}

function SideCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5">
      <h3 className="font-heading text-navy text-lg font-semibold tracking-tight">{title}</h3>
      {description && <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
