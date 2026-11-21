import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calculateAge, formatCurrency, formatDate, titleCase, toNumber } from "@/lib/format";
import { BLOOD_GROUP_OPTIONS } from "@/lib/validations/patient";
import type { getPatientById } from "@/server/patients/queries";

const BLOOD_GROUP_LABEL = Object.fromEntries(BLOOD_GROUP_OPTIONS.map((o) => [o.value, o.label]));

type Patient = NonNullable<Awaited<ReturnType<typeof getPatientById>>>;

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

export function OverviewTab({ patient }: { patient: Patient }) {
  const now = new Date();
  const nextAppointment = patient.appointments
    .filter((a) => a.date >= now && ["SCHEDULED", "CONFIRMED"].includes(a.status))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const lastVisit = patient.appointments
    .filter((a) => a.date < now)
    .sort((a, b) => b.date.getTime() - a.date.getTime())[0];

  const outstanding = patient.invoices.reduce((sum, inv) => {
    const paid = inv.payments.reduce((s, p) => s + toNumber(p.amount), 0);
    return sum + Math.max(0, toNumber(inv.total) - paid);
  }, 0);

  const mh = patient.medicalHistory;
  const alerts = [
    patient.allergies ? `Allergies: ${patient.allergies}` : null,
    mh?.hasDiabetes ? "Diabetes" : null,
    mh?.hasHypertension ? "Hypertension" : null,
    mh?.hasHeartCondition ? "Heart condition" : null,
    mh?.hasBleedingDisorder ? "Bleeding disorder" : null,
    mh?.isPregnant ? "Pregnant" : null,
    mh?.isSmoker ? "Smoker" : null,
  ].filter(Boolean) as string[];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Patient Information</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Date of Birth" value={`${formatDate(patient.dob)} (${calculateAge(patient.dob)} yrs)`} />
          <InfoRow label="Gender" value={titleCase(patient.gender)} />
          <InfoRow label="Blood Group" value={patient.bloodGroup ? BLOOD_GROUP_LABEL[patient.bloodGroup] : "—"} />
          <InfoRow label="Surgical history" value={patient.surgicalHistory || "—"} />
          <InfoRow label="Insurance" value={patient.insuranceInfo || "—"} />
          <InfoRow label="Current Medications" value={patient.currentMedications || "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          <InfoRow label="Phone" value={patient.phone} />
          <InfoRow label="Email" value={patient.email || "—"} />
          <InfoRow label="Address" value={patient.address || "—"} />
          <InfoRow label="Emergency Contact" value={patient.emergencyContactName || "—"} />
          <InfoRow label="Emergency Phone" value={patient.emergencyContactPhone || "—"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medical Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No medical alerts on record.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {alerts.map((a) => (
                <Badge key={a} variant="outline" className="bg-destructive/10 text-destructive border-transparent">
                  {a}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last Visit</CardTitle>
        </CardHeader>
        <CardContent>
          {lastVisit ? (
            <>
              <p className="text-2xl font-semibold">{formatDate(lastVisit.date)}</p>
              <p className="text-muted-foreground text-sm">with {lastVisit.dentist.name}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No visits yet.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Next Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          {nextAppointment ? (
            <>
              <p className="text-2xl font-semibold">{formatDate(nextAppointment.date)}</p>
              <p className="text-muted-foreground text-sm">with {nextAppointment.dentist.name}</p>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">Nothing scheduled.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Outstanding Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`text-2xl font-semibold ${outstanding > 0 ? "text-destructive" : ""}`}>
            {formatCurrency(outstanding)}
          </p>
          <p className="text-muted-foreground text-sm">
            across {patient.invoices.filter((i) => i.status !== "PAID").length} open invoice(s)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
