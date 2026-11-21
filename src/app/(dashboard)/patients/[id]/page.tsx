import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getPatientById } from "@/server/patients/queries";
import { PatientHeader } from "@/components/patients/profile/patient-header";
import { PatientTabs } from "@/components/patients/profile/patient-tabs";
import { OverviewTab } from "@/components/patients/profile/overview-tab";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { AppointmentsTab } from "@/components/patients/profile/appointments-tab";
import { TreatmentsTab } from "@/components/patients/profile/treatments-tab";
import { PrescriptionsTab } from "@/components/patients/profile/prescriptions-tab";
import { DocumentsTab } from "@/components/patients/profile/documents-tab";
import { BillingTab } from "@/components/patients/profile/billing-tab";
import { BackLink } from "@/components/shared/back-link";

export const metadata: Metadata = { title: "Patient Profile" };

export default async function PatientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("patients.view");
  const { id } = await params;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const visits = can(user,"opd.view") ? await prisma.encounter.findMany({ where: { appointment: { patientId: id, ...(can(user,"opd.manage") ? {} : { dentistId: user.id }) } }, orderBy: { checkedInAt: "desc" }, include: { labOrders: { where: { status: "RELEASED" }, include: { test: true } } } }) : [];
  const admissions = can(user,"ipd.view") ? await prisma.admission.findMany({ where: { patientId: id }, orderBy: { admittedAt: "desc" } }) : [];
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/patients" label="Back to Patients" />
      <PatientHeader patient={patient} user={user} />
      <PatientTabs tabs={[
        { key: "overview", label: "Overview", content: <OverviewTab patient={patient}/> },
        { key: "medical-history", label: "Medical history", content: <div className="surface-card space-y-2 p-5">
          <p>Existing conditions · {patient.medicalHistory?.otherConditions || "No additional conditions recorded"}</p>
          <p>Surgical history · {patient.surgicalHistory || "No history recorded"}</p><p>Allergies · {patient.allergies || "No information recorded"}</p>
          <p>Medications · {patient.currentMedications || "No information recorded"}</p></div> },
        ...(can(user,"appointments.view") ? [{ key: "appointments", label: "Appointments", content: <AppointmentsTab patient={patient}/> }] : []),
        ...(can(user,"opd.view") ? [{ key: "opd", label: "OPD visits", content: <div className="surface-card space-y-3 p-5">{!visits.length && "No outpatient visits."}{visits.map(v => <p key={v.id}><Link href={`/opd?visit=${v.id}`}>{v.checkedInAt.toLocaleDateString()} · Token #{v.token} · Open consultation</Link></p>)}</div> },
          { key: "laboratory", label: "Laboratory reports", content: <div className="surface-card space-y-3 p-5">{!visits.some(v => v.labOrders.length) && "No released reports."}{visits.flatMap(v => v.labOrders.map(o => <p key={o.id}><Link href={`/laboratory/${o.id}/print`}>{o.test.name} · {o.result} · {o.releasedAt?.toLocaleDateString()}</Link></p>))}</div> }] : []),
        ...(can(user,"ipd.view") ? [{ key: "admissions", label: "Admissions", content: <div className="surface-card space-y-3 p-5">{!admissions.length && "No admissions."}{admissions.map(a => <p key={a.id}>#{a.number} · {a.admittedAt.toLocaleDateString()} · {a.status} · {a.diagnosis} {a.summary}</p>)}</div> }] : []),
        ...(can(user,"treatments.view") ? [{ key: "treatments", label: "Procedures", content: <TreatmentsTab patient={patient}/> }] : []),
        ...(can(user,"prescriptions.view") ? [{ key: "prescriptions", label: "Prescriptions", content: <PrescriptionsTab patient={patient}/> }] : []),
        ...(can(user,"documents.view") ? [{ key: "documents", label: "Documents", content: <DocumentsTab patient={patient} user={user}/> }] : []),
        ...(can(user,"billing.view") ? [{ key: "billing", label: "Billing", content: <BillingTab patient={patient}/> },
          { key: "payments", label: "Payments", content: <div className="surface-card space-y-3 p-5">{!patient.invoices.some(i=>i.payments.length) && "No payments recorded."}{patient.invoices.flatMap(i=>i.payments.map(p=><p key={p.id}>{p.date.toLocaleDateString()} · {i.invoiceNumber} · {p.amount.toString()} · {p.method}</p>))}</div> }] : []),
      ]} />
    </div>
  );
}
