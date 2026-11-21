import { Stethoscope } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WEEK_DAYS, parseWorkingHours, DEFAULT_WORKING_HOURS } from "@/lib/working-hours";
import { saveDoctor } from "./actions";

export default async function Doctors() {
  await requirePermission("staff.edit");
  const doctors = await prisma.user.findMany({
    where: { role: { name: "DENTIST" } },
    include: { doctorProfile: true, department: true },
    orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        icon={<Stethoscope />}
        description="Assign doctor accounts in Staff and their departments in Departments."
      />
      {doctors.map((d) => {
        const profile = d.doctorProfile;
        const hours = parseWorkingHours(profile?.hours) ?? DEFAULT_WORKING_HOURS;
        return (
          <Card key={d.id}>
            <CardHeader>
              <CardTitle>{d.name}</CardTitle>
              <p>
                {d.department?.name ?? "Unassigned"} · {d.status} · {d.email} {d.phone}
              </p>
            </CardHeader>
            <CardContent>
              <form action={saveDoctor} className="space-y-4">
                <input type="hidden" name="userId" value={d.id} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <label>
                    Qualifications
                    <Input name="qualifications" defaultValue={profile?.qualifications} />
                  </label>
                  <label>
                    Specialty
                    <Input name="specialty" defaultValue={profile?.specialty} />
                  </label>
                  <label>
                    Consultation fee
                    <Input
                      name="consultationFee"
                      type="number"
                      step=".01"
                      min="0"
                      required
                      defaultValue={profile?.consultationFee.toString() ?? "0"}
                    />
                  </label>
                </div>
                {WEEK_DAYS.map(({ key, label }) => (
                  <div key={key} className="grid grid-cols-3 gap-2">
                    <label>
                      <input type="checkbox" name={key} defaultChecked={!hours[key].closed} /> {label}
                    </label>
                    <Input
                      aria-label={label + " start"}
                      type="time"
                      name={key + "Open"}
                      defaultValue={hours[key].shifts[0]?.open ?? "09:00"}
                    />
                    <Input
                      aria-label={label + " end"}
                      type="time"
                      name={key + "Close"}
                      defaultValue={hours[key].shifts[0]?.close ?? "17:00"}
                    />
                  </div>
                ))}
                <Button>Save doctor profile</Button>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
