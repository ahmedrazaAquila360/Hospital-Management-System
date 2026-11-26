import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { getDentists } from "@/server/appointments/queries";
import { InvoiceForm } from "@/components/billing/invoice-form";
import { createInvoiceAction } from "@/server/billing/actions";
import { FilePlus2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ToothOutline } from "@/components/brand/brand-logo";

export const metadata: Metadata = { title: "New Invoice" };

type SearchParams = Promise<{ patientId?: string; treatmentId?: string }>;

export default async function NewInvoicePage({ searchParams }: { searchParams: SearchParams }) {
  const actor = await requirePermission("billing.create");
  const params = await searchParams;

  const [dentists, treatment, services,clinic] = await Promise.all([
    getDentists(),
    params.treatmentId ? prisma.treatment.findUnique({ where: { id: params.treatmentId } }) : null,
    prisma.service.findMany({ where: { active: true, department: { active: true } }, select: { name: true, price: true } }),getClinicSettings(),
  ]);

  const patientId = params.patientId ?? treatment?.patientId;
  const defaultPatient = patientId ? await prisma.patient.findUnique({ where: { id: patientId, archivedAt: null, AND: [patientScope(actor)] }, select: { id: true, phone: true, fullName: true, patientCode: true } }) : null;

  const defaultItem = treatment
    ? {
        description: treatment.name,
        unitPrice: Number(treatment.cost) - Number(treatment.discount),
        treatmentId: treatment.id,
      }
    : undefined;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="relative">
        <PageHeader
          back={{ href: "/billing/invoices", label: "Back to Invoices" }} icon={<FilePlus2 />} title="New Invoice" description="Create an invoice for a patient visit, treatment or service." />
        <ToothOutline className="absolute -top-3 right-4 hidden md:block" />
      </div>
      <InvoiceForm
        currency={clinic.currency}
        action={createInvoiceAction}
        dentists={dentists.map((d) => ({ id: d.id, name: d.name }))}
        defaultPatient={defaultPatient}
        services={services.map(s => ({ name: s.name, price: s.price.toString() }))}
        defaultItem={defaultItem}
      />
    </div>
  );
}
