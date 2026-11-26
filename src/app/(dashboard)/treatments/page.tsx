import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, CircleCheck, Layers, Plus } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getTreatmentCounts, listTreatments } from "@/server/treatments/queries";
import { getDentists } from "@/server/appointments/queries";
import { TreatmentsToolbar } from "@/components/treatments/treatments-toolbar";
import { TreatmentsTable, type TreatmentRow } from "@/components/treatments/treatments-table";
import { ListFooter } from "@/components/shared/list-footer";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { ToothIcon } from "@/components/dental-chart/tooth-icon";
import { Button } from "@/components/ui/button";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { toNumber } from "@/lib/format";
import { TREATMENT_STATUSES } from "@/lib/validations/treatment";
import type { TreatmentStatus } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Treatments" };

type SearchParams = Promise<{ search?: string; status?: string; dentistId?: string; sort?: string; page?: string; perPage?: string }>;

const SORTS = ["date_asc", "date_desc"] as const;

export default async function TreatmentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("treatments.view");
  const currency=(await getClinicSettings()).currency;
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  // Unknown values would reach Prisma as invalid enums and fail the page.
  const status = TREATMENT_STATUSES.find((s) => s === params.status) as TreatmentStatus | undefined;
  const sort = SORTS.find((s) => s === params.sort);
  const dentistId = params.dentistId || undefined;
  const canCreate = can(user, "treatments.create");
  const canEdit = can(user, "treatments.edit");
  const canDelete = can(user, "treatments.delete");

  const [dentistUsers, list, counts] = await Promise.all([
    getDentists(),
    listTreatments({ search, status, dentistId, sort, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getTreatmentCounts(),
  ]);
  const dentists = dentistUsers.map((d) => ({ id: d.id, name: d.name }));
  const rows: TreatmentRow[] = list.treatments.map((t) => ({
    id: t.id,
    name: t.name,
    patientId: t.patientId,
    patientName: t.patient.fullName,
    dentistName: t.dentist.name,
    teeth: t.teeth.map((tt) => tt.tooth.toothNumber).sort((a, b) => a - b),
    netCost: Math.max(0, toNumber(t.cost) - toNumber(t.discount)),
    startDate: t.startDate,
    status: t.status,
  }));

  // Date header cycles: newest first → oldest first → default order.
  const nextSort = sort === undefined ? "date_desc" : sort === "date_desc" ? "date_asc" : undefined;
  const sp = new URLSearchParams();
  for (const key of ["search", "status", "dentistId", "perPage"] as const) if (params[key]) sp.set(key, params[key]!);
  if (nextSort) sp.set("sort", nextSort);
  const sortHref = sp.toString() ? `/treatments?${sp}` : "/treatments";

  const rate = counts.total ? Math.round((counts.completed / counts.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<ToothIcon />}
          title="Treatments"
          description="Manage and track all patient treatments."
          actions={
            canCreate && (
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/treatments/new">
                  <Plus /> New Treatment
                </Link>
              </Button>
            )
          }
        />
        <ToothOutline className="absolute -top-3 right-64 hidden xl:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Layers} value={counts.total} label="Total Treatments" />
        <StatCard icon={CalendarDays} value={counts.planned} label={counts.inProgress ? `Planned · ${counts.inProgress} in progress` : "Planned"} />
        <StatCard icon={CircleCheck} value={counts.completed} label="Completed" tone="success" />
        <div className="surface-card flex items-center gap-4 p-4 sm:p-5">
          <span
            className="relative hidden size-12 shrink-0 rounded-full sm:block"
            style={{ background: `conic-gradient(var(--color-success) ${rate * 3.6}deg, var(--muted) 0deg)` }}
            aria-hidden
          >
            <span className="bg-card absolute inset-1.5 rounded-full" />
          </span>
          <span className="min-w-0">
            <span className="font-heading text-navy block text-2xl leading-none font-semibold tabular-nums sm:text-[1.7rem]">{rate}%</span>
            <span className="text-muted-foreground mt-1 block text-xs leading-tight sm:text-sm">Completion Rate</span>
          </span>
        </div>
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <TreatmentsToolbar dentists={dentists} />
        <TreatmentsTable currency={currency} rows={rows} canEdit={canEdit} canDelete={canDelete} filtered={Boolean(search || status || dentistId)} sort={sort} sortHref={sortHref} />
        <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={rows.length} noun="treatment" />
      </section>
    </div>
  );
}
