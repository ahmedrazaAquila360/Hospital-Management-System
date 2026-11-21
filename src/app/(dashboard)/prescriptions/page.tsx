import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Pill, Plus, Stethoscope, Users } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { getPrescriptionStats, listPrescriptions } from "@/server/prescriptions/queries";
import { getDentists } from "@/server/appointments/queries";
import { PrescriptionsToolbar } from "@/components/prescriptions/prescriptions-toolbar";
import { PrescriptionsList } from "@/components/prescriptions/prescriptions-list";
import { ListFooter } from "@/components/shared/list-footer";
import { parsePage, parsePageSize } from "@/lib/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { ToothOutline } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Prescriptions" };

type SearchParams = Promise<{ search?: string; dentistId?: string; page?: string; perPage?: string }>;

export default async function PrescriptionsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requirePermission("prescriptions.view");
  const params = await searchParams;
  const search = params.search?.trim() || undefined;
  const dentistId = params.dentistId || undefined;

  const [list, stats, dentists] = await Promise.all([
    listPrescriptions({ search, dentistId, page: parsePage(params.page), pageSize: parsePageSize(params.perPage) }),
    getPrescriptionStats(),
    getDentists(),
  ]);
  const rows = list.prescriptions.map((rx) => ({
    id: rx.id,
    date: rx.date,
    patientName: rx.patient.fullName,
    patientCode: rx.patient.patientCode,
    patientPhoto: rx.patient.photoUrl,
    dentistName: rx.dentist.name,
    medicines: rx.medicines.map((m) => m.medicineName),
  }));


  return (
    <div className="flex flex-col gap-6">
      <div className="relative">
        <PageHeader
          icon={<Pill />}
          title="Prescriptions"
          description="Manage patient prescriptions and medication records."
          actions={
            can(user, "prescriptions.create") && (
              <Button asChild size="lg" className="rounded-full px-5">
                <Link href="/prescriptions/new">
                  <Plus /> New Prescription
                </Link>
              </Button>
            )
          }
        />
        <ToothOutline className="absolute -top-3 right-64 hidden xl:block" />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard icon={FileText} value={stats.total} label="Total Prescriptions" />
        <StatCard icon={Users} value={stats.patients} label="Patients" />
        <StatCard icon={Stethoscope} value={stats.dentists} label="Prescribing Doctors" />
      </div>

      <section className="surface-card @container overflow-hidden p-0">
        <PrescriptionsToolbar dentists={dentists.map((d) => ({ id: d.id, name: d.name }))} />
        <PrescriptionsList rows={rows} filtered={Boolean(search || dentistId)} />
        {rows.length > 0 && (
          <ListFooter page={list.page} pageSize={list.pageSize} total={list.total} shown={rows.length} noun="prescription" />
        )}
      </section>
    </div>
  );
}
