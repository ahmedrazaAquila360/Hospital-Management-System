import { encounterScope } from "@/server/encounters/scope";
import Link from "next/link";
import { Stethoscope } from "lucide-react";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { orderTest } from "../laboratory/actions";
import { documentVisit } from "./actions";
import { vitalFields } from "./vitals";

export default async function Outpatients({ searchParams }: { searchParams: Promise<{ visit?: string; amend?: string }> }) {
  const doctor = await requirePermission("opd.view");
  const { visit, amend } = await searchParams;
  const scope = can(doctor, "opd.manage") ? {} : { dentistId: doctor.id };
  if (!visit) {
    const waiting = await prisma.encounter.findMany({
      where: { appointment: { ...scope, status: { in: ["CHECKED_IN", "IN_PROGRESS"] } } },
      orderBy: { token: "asc" },
      include: {
        appointment: {
          select: {
            patient: { select: { fullName: true, patientCode: true } },
            dentist: { select: { name: true } },
            status: true,
          },
        },
      },
    });
    const inpatient = await prisma.admission.findMany({
      where: { dischargedAt: null, ...(can(doctor, "opd.manage") ? {} : { doctorId: doctor.id }) },
      include: { encounter: true, patient: { select: { fullName: true } } },
    });
    return (
      <div className="space-y-6">
        <PageHeader
          title="Outpatient queue"
          icon={<Stethoscope />}
          description="Patients appear here when reception checks them in."
        />
        <Card>
          <CardHeader>
            <CardTitle>Waiting and in consultation</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            {!waiting.length && <p>No patients in the queue.</p>}
            {waiting.map((v) => (
              <Link
                className="flex flex-wrap justify-between gap-3 py-3"
                key={v.id}
                href={`/opd?visit=${v.id}`}
              >
                <span>
                  #{v.token} · {v.appointment?.patient.fullName} · {v.appointment?.patient.patientCode}
                </span>
                <span>
                  {v.appointment?.dentist.name} · {v.appointment?.status.replaceAll("_", " ").toLowerCase()}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
        {inpatient.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Inpatient rounds</CardTitle>
            </CardHeader>
            <CardContent>
              {inpatient.map(
                (a) =>
                  a.encounter && (
                    <p key={a.id}>
                      <Link href={`/opd?visit=${a.encounter.id}`}>
                        Admission #{a.number} · {a.patient.fullName}
                      </Link>
                    </p>
                  ),
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }
  const encounter = await prisma.encounter.findFirst({
    where: { id: visit, ...encounterScope(doctor) },
    include: { admission: { include: { patient: true } }, appointment: { include: { patient: true } } },
  });
  if (!encounter) notFound();
  const patient = encounter.appointment?.patient ?? encounter.admission?.patient;
  if (!patient) notFound();
  const tests = can(doctor, "lab.create") ? await prisma.labTest.findMany({ orderBy: { name: "asc" } }) : [];
  const orders = await prisma.labOrder.findMany({
    where: { encounterId: visit },
    include: { test: true },
    orderBy: { createdAt: "desc" },
  });
  const history = await prisma.clinicalNote.findMany({
    where: { encounter: encounterScope(doctor, patient.id) },
    include: { author: { select: { name: true } }, amendment: { select: { id:true } } },
    orderBy: { createdAt: "desc" },
  });
  const original = amend ? history.find(n=>n.id===amend && n.encounterId===visit && !n.amendment && (n.authorId===doctor.id || can(doctor,"opd.manage"))) : undefined;
  if (amend && !original) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={patient.fullName}
        description={`${patient.patientCode} · ${encounter.admission ? "Admission #" + encounter.admission.number : "Token " + encounter.token}`}
        back={{ href: "/opd", label: "Outpatient queue" }}
      />
      <Card>
        <CardHeader>
          <CardTitle>Clinical history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {can(doctor,"vitals.view")&&<Link className="underline" href={`/vitals?visit=${visit}`}>Timestamped vital observations and review history</Link>}
          <p>Recorded allergies · {patient.allergies || "No information recorded"}</p>
          <p>Current medications · {patient.currentMedications || "No information recorded"}</p>
          {history.map((n) => (
            <article key={n.id} className="border-t py-3">
              <small>
                {n.createdAt.toLocaleString()} · {n.author.name}
              </small>
              <h3 className="font-semibold">{n.diagnosis}</h3>
              {n.amendmentReason && <p>Amendment · {n.amendmentReason}</p>}
              {n.amendment ? <p>Superseded by a signed amendment</p> : can(doctor,"opd.edit") && (doctor.id===n.authorId || can(doctor,"opd.manage")) && <Link className="text-brand" href={`/opd?visit=${n.encounterId}&amend=${n.id}#consultation-note`}>Amend note</Link>}
              <p>{n.narrative}</p>
              <p>{n.instructions}</p>
              {n.vitals &&
                typeof n.vitals === "object" &&
                !Array.isArray(n.vitals) &&
                Object.entries(n.vitals).map(([key, value]) => (
                  <p key={key}>
                    {vitalFields.find(([k]) => k === key)?.[1]} · {String(value)}
                  </p>
                ))}
              {n.followUp && <p>Follow-up · {n.followUp.toISOString().slice(0, 10)} {can(doctor,"appointments.create") && <Link className="text-brand" href={`/appointments/new?patientId=${patient.id}&date=${n.followUp.toISOString().slice(0,10)}&followUp=1`}>Book follow-up</Link>}</p>}
            </article>
          ))}
        </CardContent>
      </Card>
      {can(doctor, "opd.edit") && (
        <Card>
          <CardHeader>
            <CardTitle>Consultation note</CardTitle>
          </CardHeader>
          <CardContent>
            <form key={amend ?? "new"} id="consultation-note" action={documentVisit} className="space-y-4">
              <input type="hidden" name="encounterId" value={visit} />
              {original && <><input type="hidden" name="previousId" value={original.id}/><label>Reason for amendment<Input name="amendmentReason" required maxLength={1000}/></label></>}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {vitalFields.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <Input type="number" step="any" min="0" name={key} defaultValue={original?.vitals && typeof original.vitals === "object" && !Array.isArray(original.vitals) ? String(original.vitals[key] ?? "") : ""} />
                  </label>
                ))}
              </div>
              <label className="block">
                Diagnosis
                <Input defaultValue={original?.diagnosis} required name="diagnosis" maxLength={2000} />
              </label>
              <label className="block">
                Clinical notes
                <Textarea defaultValue={original?.narrative} required name="narrative" maxLength={8000} />
              </label>
              <label className="block">
                Treatment instructions
                <Textarea defaultValue={original?.instructions ?? ""} name="instructions" maxLength={4000} />
              </label>
              <label className="block">
                Follow-up date
                <Input type="date" defaultValue={original?.followUp?.toISOString().slice(0,10)} name="followUp" />
              </label>
              <Button>{original ? "Sign amendment" : "Sign and add note"}</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Laboratory orders</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {can(doctor, "lab.create") && tests.length > 0 && (
            <form action={orderTest} className="flex gap-2">
              <input type="hidden" name="encounterId" value={visit} />
              <select name="testId" aria-label="Test" required>
                {tests.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <Button>Order test</Button>
            </form>
          )}
          {!orders.length && <p>No tests ordered for this visit.</p>}
          {orders.map((o) => (
            <p key={o.id}>
              {o.test.name} · {o.status.toLowerCase().replaceAll("_", " ")}{" "}
              {o.status === "RELEASED" && `· ${o.result} · Reference ${o.referenceRange || "unspecified"}`}
            </p>
          ))}
        </CardContent>
      </Card>
      <div className="flex flex-wrap gap-4">
        {can(doctor, "prescriptions.create") && (
          <Link
            href={`/prescriptions/new?patientId=${patient.id}&encounterId=${encounter.id}${encounter.appointmentId ? "&appointmentId=" + encounter.appointmentId : ""}`}
          >
            Write prescription
          </Link>
        )}
        {encounter.appointmentId && can(doctor, "appointments.view") && (
          <Link href={`/appointments/${encounter.appointmentId}`}>Appointment details</Link>
        )}
      </div>
    </div>
  );
}
