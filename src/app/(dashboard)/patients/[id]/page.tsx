import {getClinicSettings} from "@/server/settings/queries";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { getPatientById } from "@/server/patients/queries";
import { PatientHeader } from "@/components/patients/profile/patient-header";
import { PatientTabs } from "@/components/patients/profile/patient-tabs";
import { OverviewTab } from "@/components/patients/profile/overview-tab";
import { can } from "@/lib/permissions";
import { encounterScope } from "@/server/encounters/scope";
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
  const currency=(await getClinicSettings()).currency;
  const { id } = await params;
  const patient = await getPatientById(id);
  if (!patient) notFound();

  const encounters = can(user,"opd.view") ? await prisma.encounter.findMany({
    where: encounterScope(user, id), orderBy: { checkedInAt: "desc" },
    include: { labOrders: { where: { status: "RELEASED" }, include: { test: true } }, notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } }, amendment: { select: { id: true } } } } },
  }) : [];
  const visits = encounters.filter(e => e.appointmentId);
  const timeline = encounters.flatMap(e => e.notes.map(note => ({ ...note, inpatient: !!e.admissionId }))).sort((a,b) => b.createdAt.getTime() - a.createdAt.getTime());
  const admissions = can(user,"ipd.view") ? await prisma.admission.findMany({ where: { patientId: id }, orderBy: { admittedAt: "desc" } }) : [];
  return (
    <div className="flex flex-col gap-4">
      <BackLink href="/patients" label="Back to Patients" />
      <PatientHeader patient={patient} user={user} />
      <PatientTabs tabs={[
        { key: "overview", label: "Overview", content: <OverviewTab currency={currency} patient={patient} showBilling={can(user,"billing.view")}/> },
        { key: "medical-history", label: "Medical history", content: <div className="surface-card space-y-2 p-5">
          <p>Existing conditions · {patient.medicalHistory?.otherConditions || "No additional conditions recorded"}</p>
          <p>Surgical history · {patient.surgicalHistory || "No history recorded"}</p><p>Allergies · {patient.allergies || "No information recorded"}</p>
          <p>Medications · {patient.currentMedications || "No information recorded"}</p></div> },
        ...(can(user,"appointments.view") ? [{ key: "appointments", label: "Appointments", content: <AppointmentsTab patient={patient}/> }] : []),
        ...(can(user,"opd.view") ? [{ key: "timeline", label: "Clinical timeline", content: <div className="surface-card space-y-4 p-5">
          {!timeline.length && <p>No clinical notes recorded.</p>}
          {timeline.map(n => <article key={n.id} className="space-y-1 border-b pb-3">
            <p className="text-sm text-muted-foreground">{n.createdAt.toLocaleString()} · {n.inpatient ? "Inpatient" : "Outpatient"} · {n.author.name}</p>
            <h3 className="font-semibold">{n.diagnosis}</h3><p>{n.narrative}</p><p>{n.instructions}</p>
            {n.amendmentReason && <p>Amendment reason · {n.amendmentReason}</p>}
            {n.amendment && <p>Superseded by a signed amendment</p>}
            <Link className="text-brand underline" href={`/opd?visit=${n.encounterId}`}>Open clinical encounter</Link>
          </article>)}
        </div> }, { key: "opd", label: "OPD visits", content: <div className="surface-card space-y-3 p-5">{!visits.length && "No outpatient visits."}{visits.map(v => <p key={v.id}><Link href={`/opd?visit=${v.id}`}>{v.checkedInAt.toLocaleDateString()} · Token #{v.token} · Open consultation</Link></p>)}</div> },
          { key: "laboratory", label: "Laboratory reports", content: <div className="surface-card space-y-3 p-5">{!encounters.some(v => v.labOrders.length) && "No released reports."}{encounters.flatMap(v => v.labOrders.map(o => <p key={o.id}><Link href={`/laboratory/${o.id}/print`}>{o.test.name} · {o.result} · {o.releasedAt?.toLocaleDateString()}</Link></p>))}</div> }] : []),
        ...(can(user,"ipd.view") ? [{ key: "admissions", label: "Admissions", content: <div className="surface-card space-y-3 p-5">{!admissions.length && "No admissions."}{admissions.map(a => <p key={a.id}>#{a.number} · {a.admittedAt.toLocaleDateString()} · {a.status} · {a.diagnosis} {a.summary}</p>)}</div> }] : []),
        ...(can(user,"treatments.view") ? [{ key: "treatments", label: "Procedures", content: <TreatmentsTab currency={currency} patient={patient}/> }] : []),
        ...(can(user,"prescriptions.view") ? [{ key: "prescriptions", label: "Prescriptions", content: <PrescriptionsTab patient={patient}/> }] : []),
        ...(can(user,"documents.view") ? [{ key: "documents", label: "Documents", content: <DocumentsTab patient={patient} user={user}/> }] : []),
        ...(can(user,"billing.view") ? [{ key: "billing", label: "Billing", content: <BillingTab currency={currency} patient={patient}/> },
          { key: "payments", label: "Payments", content: <div className="surface-card space-y-3 p-5">{!patient.invoices.some(i=>i.payments.length) && "No payments recorded."}{patient.invoices.flatMap(i=>i.payments.map(p=><p key={p.id}>{p.date.toLocaleDateString()} · {i.invoiceNumber} · {p.amount.toString()} · {p.method}</p>))}</div> }] : []),
      ]} />
    </div>
  );
}
