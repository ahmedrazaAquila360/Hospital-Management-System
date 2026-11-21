import type { Metadata } from "next";
import Link from "next/link";
import { Activity, CalendarCheck2, Plus, UserPlus, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { listPatients, getDentistOptions } from "@/server/patients/queries";
import { getDashboardStats } from "@/server/dashboard/queries";
import { PatientsToolbar } from "@/components/patients/patients-toolbar";
import { PatientsTable, type PatientRow } from "@/components/patients/patients-table";
import { ListFooter } from "@/components/shared/list-footer";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { parsePage, parsePageSize } from "@/lib/pagination";
import type { Gender } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Patients" };

const SORTS = ["name_asc", "name_desc", "recent", "oldest"] as const;
const GENDERS = ["MALE", "FEMALE", "OTHER"] as const;

type SearchParams = Promise<{
  search?: string;
  gender?: string;
  dentistId?: string;
  sort?: string;
  page?: string;
  perPage?: string;
}>;

export default async function PatientsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("patients.view");
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  // Unknown values would reach Prisma as invalid enums and fail the page.
  const gender = GENDERS.find((g) => g === params.gender) as Gender | undefined;
  const sort = SORTS.find((s) => s === params.sort);
  const dentistId = params.dentistId || undefined;
  const canManage = can(user, "patients.edit");
  const canCreate = can(user, "patients.create");

  const [dentistUsers, list, stats] = await Promise.all([
    getDentistOptions(),
    listPatients({ search, gender, dentistId, sort, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getDashboardStats(),
  ]);
  // Whole User rows must not reach a client component: pass only id and name.
  const dentists = dentistUsers.map((d) => ({ id: d.id, name: d.name }));
  const rows: PatientRow[] = list.rows.map((r) => ({
    id: r.id,
    patientCode: r.patientCode,
    fullName: r.fullName,
    photoUrl: r.photoUrl,
    phone: r.phone,
    dob: r.dob,
    gender: r.gender,
    lastVisit: r.lastVisit,
    dentist: r.dentist,
    treatmentStatus: r.treatmentStatus,
    outstandingBalance: r.outstandingBalance,
  }));
  const filtered = Boolean(search || gender || dentistId);

  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<Users />}
          title="Patients"
          description="Search, filter and manage every patient record in the clinic."
          actions={
            canCreate && (
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/patients/new">
                  <Plus /> Add Patient
                </Link>
              </Button>
            )
          }
        />
        <ToothOutline className="absolute -top-3 right-56 hidden xl:block" />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-4">
        <StatCard icon={Users} value={stats.totalPatients} label="Total Patients" />
        <StatCard icon={UserPlus} value={stats.newPatientsThisMonth} label="New This Month" tone="success" />
        <StatCard icon={Activity} value={stats.activeTreatments} label="Active Treatments" tone="warning" />
        <StatCard icon={CalendarCheck2} value={stats.todayAppointments} label="Appointments Today" />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <PatientsToolbar dentists={dentists} />
        <PatientsTable rows={rows} canManage={canManage} canDelete={can(user, "patients.delete")} filtered={filtered} />
        <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={rows.length} noun="patient" />
      </section>
    </div>
  );
}
