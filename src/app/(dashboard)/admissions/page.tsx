import Link from "next/link";
import { BedDouble } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addBed, housekeeping, admit, updateAdmission } from "./actions";

export default async function Admissions() {
  const user = await requirePermission("ipd.view");
  const [beds, admissions, doctors] = await Promise.all([
    prisma.bed.findMany({ orderBy: [{ ward: "asc" }, { room: "asc" }, { label: "asc" }] }),
    prisma.admission.findMany({
      orderBy: { admittedAt: "desc" },
      include: {
        encounter: { select: { id: true } },
        patient: { select: { fullName: true, patientCode: true } },
        doctor: { select: { name: true } },
        department: true,
        bed: true,
      },
    }),
    prisma.user.findMany({
      where: { role: { name: "DENTIST" }, department: { active: true }, status: "ACTIVE" },
      select: { id: true, name: true },
    }),
  ]);
  const available = beds.filter((b) => b.status === "AVAILABLE");
  const bedOptions = available.map((b) => (
    <option key={b.id} value={b.id}>
      {b.ward} · {b.room} · {b.label}
    </option>
  ));
  return (
    <div className="space-y-6">
      <PageHeader title="Admissions and beds" icon={<BedDouble />} />
      {can(user, "ipd.manage") && (
        <Card>
          <CardHeader>
            <CardTitle>Add bed</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addBed} className="grid gap-3 sm:grid-cols-4">
              {["ward", "room", "label", "category"].map((k) => (
                <label key={k} className="capitalize">
                  {k}
                  <Input name={k} required />
                </label>
              ))}
              <label>
                Nightly rate
                <Input required type="number" min="0" step=".01" name="nightlyRate" defaultValue="0" />
              </label>
              <Button>Add bed</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {beds.map((b) => (
          <Card key={b.id}>
            <CardHeader>
              <CardTitle>
                {b.ward} · {b.room} · {b.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p>
                {b.category} · {b.status.toLowerCase()}
              </p>
              {can(user, "ipd.manage") && b.status !== "OCCUPIED" && (
                <form action={housekeeping} className="flex flex-wrap gap-2">
                  <input type="hidden" name="bedId" value={b.id} />
                  <select aria-label="Bed status" name="status" defaultValue={b.status}>
                    {["AVAILABLE", "RESERVED", "MAINTENANCE", "CLEANING"].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <Button variant="outline">Update</Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
      {can(user, "ipd.create") && (
        <Card>
          <CardHeader>
            <CardTitle>Register admission</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={admit} className="grid gap-3 sm:grid-cols-2">
              <label>
                Patient MRN
                <Input name="patientCode" required />
              </label>
              <label>
                Attending doctor
                <select required name="doctorId" className="block w-full rounded border p-2">
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Available bed
                <select name="bedId" required className="block w-full rounded border p-2">
                  {bedOptions}
                </select>
              </label>
              <label>
                Admission diagnosis
                <Input name="diagnosis" required />
              </label>
              {can(user, "billing.payments") && (
                <>
                  <label>
                    Deposit received
                    <Input name="deposit" type="number" min="0" step=".01" defaultValue="0" />
                  </label>
                  <label>
                    Deposit method
                    <select name="method" className="block">
                      {["CASH", "CARD", "BANK_TRANSFER", "INSURANCE", "OTHER"].map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                </>
              )}
              <label><input type="checkbox" name="requestOnly"/> Reserve bed pending admission</label>
              <Button disabled={!available.length || !doctors.length}>Admit patient</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Admission register</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!admissions.length && <p>No admissions recorded.</p>}
          {admissions.map((a) => (
            <article key={a.id} className="space-y-2 border-t py-3">
              <h3 className="font-semibold">
                #{a.number} · {a.patient.fullName} · {a.patient.patientCode}
              </h3>
              <p>
                {a.doctor.name} · {a.department.name} · {a.bed.ward} / {a.bed.room} / {a.bed.label}
              </p>
              <p>
                {a.diagnosis} · {a.status.toLowerCase().replaceAll("_", " ")}
              </p>
              <p>{a.summary}</p>
              {a.encounter && can(user, "opd.view") && (
                <Link href={`/opd?visit=${a.encounter.id}`}>Clinical workspace</Link>
              )}
              {a.status === "REQUESTED" && can(user,"ipd.create") && <form action={updateAdmission}><input type="hidden" name="id" value={a.id}/><Button name="action" value="confirm">Confirm admission</Button><Button variant="outline" name="action" value="cancel">Cancel request</Button></form>}
              {a.status === "ADMITTED" && can(user,"ipd.edit") && <form action={updateAdmission}><input type="hidden" name="id" value={a.id}/><Button variant="outline" name="action" value="activate">Mark active</Button></form>}
              {a.status !== "REQUESTED" && a.status !== "CANCELLED" && !a.dischargedAt && (
                <div className="flex flex-wrap gap-3">
                  {can(user, "ipd.edit") && a.status !== "DISCHARGE_REQUESTED" && (
                    <>
                      <form action={updateAdmission}>
                        <input type="hidden" name="id" value={a.id} />
                        <select aria-label="Transfer destination" name="bedId" required>
                          {bedOptions}
                        </select>
                        <Button name="action" value="transfer" variant="outline" disabled={!available.length}>
                          Transfer
                        </Button>
                      </form>
                      <form action={updateAdmission}>
                        <input type="hidden" name="id" value={a.id} />
                        <Button name="action" value="request" variant="outline">
                          Request discharge
                        </Button>
                      </form>
                    </>
                  )}
                  {can(user, "ipd.approve") && a.status === "DISCHARGE_REQUESTED" && (
                    <form action={updateAdmission}>
                      <input type="hidden" name="id" value={a.id} />
                      <label>
                        Discharge summary
                        <Textarea name="summary" required />
                      </label>
                      <Button name="action" value="discharge">
                        Discharge
                      </Button>
                    </form>
                  )}
                </div>
              )}
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
