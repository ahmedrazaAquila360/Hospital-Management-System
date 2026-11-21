import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CalendarDays,
  CircleCheck,
  CircleX,
  Clock3,
  Hourglass,
  Inbox,
  Mail,
  Phone,
  Search,
  Stethoscope,
  UserPlus,
} from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { listAppointmentRequests } from "@/server/appointment-requests/queries";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RequestActions } from "@/components/appointments/request-actions";
import { ListFooter } from "@/components/shared/list-footer";
import { DEFAULT_PAGE_SIZE, parsePage, parsePageSize } from "@/lib/pagination";
import { ListSearch } from "@/components/shared/list-search";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { formatDate, formatDateTime, initialsFromName } from "@/lib/format";
import { PREFERRED_TIME_LABEL } from "@/lib/validations/appointment-request";
import { cn } from "@/lib/utils";
import type { RequestStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Appointment Requests" };

const STATUSES: { value: RequestStatus; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "DECLINED", label: "Declined" },
];

type SearchParams = Promise<{ status?: string; q?: string; page?: string; perPage?: string }>;
type Request = Awaited<ReturnType<typeof listAppointmentRequests>>[number];

export default async function AppointmentRequestsPage({ searchParams }: { searchParams: SearchParams }) {
  await requirePermission("appointments.requests");
  const params = await searchParams;
  const status = STATUSES.find((s) => s.value === params.status)?.value ?? "PENDING";
  const q = params.q?.trim().toLowerCase() ?? "";

  // The existing query, once per status: gives the summary counts and the active list.
  const [pending, confirmed, declined] = await Promise.all(
    STATUSES.map((s) => listAppointmentRequests(s.value))
  );
  const byStatus: Record<RequestStatus, Request[]> = { PENDING: pending, CONFIRMED: confirmed, DECLINED: declined };

  const matching = q
    ? byStatus[status].filter((r) => [r.fullName, r.phone, r.email ?? ""].some((v) => v.toLowerCase().includes(q)))
    : byStatus[status];
  const pageSize = parsePageSize(params.perPage);
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const page = Math.min(pageCount, parsePage(params.page));
  const rows = matching.slice((page - 1) * pageSize, page * pageSize);

  const hrefFor = (next: { status?: RequestStatus; page?: number }) => {
    const sp = new URLSearchParams();
    sp.set("status", next.status ?? status);
    if (q && !next.status) sp.set("q", params.q!.trim());
    if (pageSize !== DEFAULT_PAGE_SIZE) sp.set("perPage", String(pageSize));
    if (next.page && next.page > 1) sp.set("page", String(next.page));
    return `/appointments/requests?${sp.toString()}`;
  };
  const label = STATUSES.find((s) => s.value === status)!.label.toLowerCase();

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/appointments", label: "Back to Appointments" }}
          icon={<CalendarClock />}
          title="Appointment Requests"
          description="Booking requests submitted from the public website."
          actions={
            <Button asChild variant="outline">
              <Link href="/appointments">
                <CalendarDays /> Calendar
              </Link>
            </Button>
          }
        />
        <ToothOutline className="absolute -top-3 right-56 hidden lg:block" />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard icon={Hourglass} value={pending.length} label="Pending Requests" href={hrefFor({ status: "PENDING" })} active={status === "PENDING"} />
        <StatCard icon={CircleCheck} value={confirmed.length} label="Confirmed Requests" tone="success" href={hrefFor({ status: "CONFIRMED" })} active={status === "CONFIRMED"} />
        <StatCard icon={CircleX} value={declined.length} label="Declined Requests" tone="destructive" href={hrefFor({ status: "DECLINED" })} active={status === "DECLINED"} />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <nav className="bg-muted/70 flex w-fit max-w-full overflow-x-auto rounded-xl p-1" aria-label="Request status">
            {STATUSES.map((s) => (
              <Link
                key={s.value}
                href={hrefFor({ status: s.value })}
                aria-current={status === s.value ? "page" : undefined}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                  status === s.value ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s.label} ({byStatus[s.value].length})
              </Link>
            ))}
          </nav>
          <ListSearch placeholder="Search by name, phone or email…" showRefresh className="lg:max-w-xl" />
        </div>

        {rows.length === 0 ? (
          <Empty className="w-auto border-border/70 mx-4 mb-5 rounded-2xl border border-dashed py-12 sm:mx-5">
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>{q ? "No matching requests" : `No ${label} requests`}</EmptyTitle>
            <EmptyDescription>
              {q ? "Try a different name, phone number or email." : "Booking requests from the website will show up here."}
            </EmptyDescription>
            {q && (
              <EmptyContent>
                <Button asChild variant="outline">
                  <Link href={hrefFor({ status })}>Clear search</Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <>
            {/* Table from a ~56rem card width; stacked cards below that. */}
            <div className="hidden @4xl:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-left text-xs font-semibold">
                    <th className="py-3 pr-3 pl-5">Patient</th>
                    <th className="px-3 py-3">Requested For</th>
                    <th className="px-3 py-3">Reason</th>
                    <th className="px-3 py-3">Contact</th>
                    <th className="px-3 py-3">Submitted</th>
                    <th className="py-3 pr-5 pl-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border/60 divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-pale/40 transition-colors">
                      <td className="py-3.5 pr-3 pl-5">
                        <div className="flex items-center gap-3">
                          <RequestAvatar name={r.fullName} />
                          <div className="min-w-0">
                            <p className="text-navy font-semibold">{r.fullName}</p>
                            <p className="text-muted-foreground flex items-center gap-1 text-xs">
                              <Stethoscope className="size-3" aria-hidden /> {r.preferredDentistName ?? "Any dentist"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3.5">
                        <RequestedFor r={r} />
                      </td>
                      <td className="text-foreground/80 max-w-56 px-3 py-3.5">
                        <p className="line-clamp-2">{r.reason || <span className="text-muted-foreground">Not given</span>}</p>
                      </td>
                      <td className="px-3 py-3.5">
                        <Contact r={r} />
                      </td>
                      <td className="text-foreground/80 px-3 py-3.5 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                      <td className="py-3.5 pr-5 pl-3">
                        <RowActions r={r} pending={status === "PENDING"} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-border/60 divide-y @4xl:hidden">
              {rows.map((r) => (
                <li key={r.id} className="flex flex-col gap-3 px-4 py-4 sm:px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <RequestAvatar name={r.fullName} />
                      <div className="min-w-0">
                        <p className="text-navy truncate font-semibold">{r.fullName}</p>
                        <p className="text-muted-foreground text-xs">Submitted {formatDateTime(r.createdAt)}</p>
                      </div>
                    </div>
                    <RowActions r={r} pending={status === "PENDING"} />
                  </div>
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <RequestedFor r={r} />
                    <Contact r={r} />
                  </div>
                  {r.reason && <p className="bg-muted/40 text-foreground/80 rounded-xl px-3 py-2 text-sm">{r.reason}</p>}
                </li>
              ))}
            </ul>

            <ListFooter page={page} pageSize={pageSize} total={matching.length} shown={rows.length} noun={`${label} request`} />
          </>
        )}
      </section>
    </div>
  );
}

function RequestAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-10 shrink-0">
      <AvatarFallback className="bg-linear-to-br from-[#e3f4fd] to-[#cbe8fa] text-xs font-semibold text-navy">
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}

function RequestedFor({ r }: { r: Request }) {
  return (
    <div className="space-y-0.5">
      <p className="text-navy flex items-center gap-1.5 font-medium whitespace-nowrap">
        <CalendarDays className="text-muted-foreground size-3.5" aria-hidden />
        {/* preferredDate is a DATE column (UTC midnight): format the UTC calendar day. */}
        {formatDate(new Date(r.preferredDate.toISOString().slice(0, 10) + "T00:00:00"))}
      </p>
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Clock3 className="size-3" aria-hidden /> {PREFERRED_TIME_LABEL[r.preferredTime] ?? r.preferredTime}
      </p>
    </div>
  );
}

function Contact({ r }: { r: Request }) {
  return (
    <div className="min-w-0 space-y-0.5 text-sm">
      <a href={`tel:${r.phone}`} className="text-foreground/85 hover:text-brand flex items-center gap-1.5 tabular-nums">
        <Phone className="text-muted-foreground size-3.5 shrink-0" aria-hidden /> {r.phone}
      </a>
      {r.email ? (
        <a href={`mailto:${r.email}`} className="text-foreground/85 hover:text-brand flex min-w-0 items-center gap-1.5">
          <Mail className="text-muted-foreground size-3.5 shrink-0" aria-hidden /> <span className="truncate">{r.email}</span>
        </a>
      ) : (
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Mail className="size-3.5" aria-hidden /> No email
        </p>
      )}
    </div>
  );
}

function RowActions({ r, pending }: { r: Request; pending: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1.5">
      {pending && <RequestActions id={r.id} name={r.fullName} />}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon" variant="ghost" className="bg-muted/70 size-9 rounded-xl">
            <Link href={`/patients?search=${encodeURIComponent(r.phone)}`} aria-label={`Find existing patient for ${r.fullName}`}>
              <Search />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Find existing patient</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild size="icon" variant="ghost" className="bg-pale text-brand size-9 rounded-xl">
            <Link
              href={`/patients/new?fullName=${encodeURIComponent(r.fullName)}&phone=${encodeURIComponent(r.phone)}`}
              aria-label={`Register ${r.fullName} as a patient`}
            >
              <UserPlus />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Register as patient</TooltipContent>
      </Tooltip>
    </div>
  );
}
