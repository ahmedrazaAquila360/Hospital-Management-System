import Link from "next/link";
import { FlaskConical } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { addTest, advanceTest } from "./actions";
import { labTransitions } from "./workflow";

export default async function Laboratory() {
  const user = await requirePermission("lab.view");
  const orders = await prisma.labOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      test: true,
      encounter: {
        include: {
          admission: { select: { patient: { select: { fullName: true, patientCode: true } } } },
          appointment: { select: { patient: { select: { fullName: true, patientCode: true } } } },
        },
      },
    },
  });
  return (
    <div className="space-y-6">
      <PageHeader title="Laboratory" icon={<FlaskConical />} />
      {can(user, "lab.manage") && (
        <Card>
          <CardHeader>
            <CardTitle>Add catalog test</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 sm:grid-cols-2" action={addTest}>
              <label>
                Test name
                <Input name="name" required />
              </label>
              <label>
                Category
                <Input name="category" required />
              </label>
              <label>
                Price
                <Input type="number" step=".01" min="0" name="price" required />
              </label>
              <label>
                Reference range and units
                <Input name="referenceRange" />
              </label>
              <Button>Add test</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Laboratory worklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!orders.length && <p>No laboratory orders.</p>}
          {orders.map((o) => (
            <article key={o.id} className="space-y-2 border-t py-4">
              <h3 className="font-semibold">
                {o.test.name} ·{" "}
                {o.encounter.appointment?.patient.fullName ?? o.encounter.admission?.patient.fullName} ·{" "}
                {o.encounter.appointment?.patient.patientCode ?? o.encounter.admission?.patient.patientCode}
              </h3>
              <p>
                {o.status.replaceAll("_", " ")} {o.sampleId && `· Sample ${o.sampleId}`}
              </p>
              {o.status === "RELEASED" && <Link href={`/laboratory/${o.id}/print`}>Print report</Link>}
              {o.result && (
                <p>
                  {o.result} · {o.abnormal ? "Flagged abnormal" : "Unflagged"} · Reference{" "}
                  {o.referenceRange || "unspecified"}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {labTransitions[o.status]
                  .filter((s) => can(user, s === "VERIFIED" || s === "RELEASED" ? "lab.approve" : "lab.edit"))
                  .map((s) => (
                    <form action={advanceTest} key={s} className="space-y-2">
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value={s} />
                      {s === "SAMPLE_COLLECTED" && (
                        <label>
                          Sample identifier
                          <Input name="sampleId" required />
                        </label>
                      )}
                      {s === "COMPLETED" && (
                        <>
                          <label>
                            Result and units
                            <Textarea name="result" required />
                          </label>
                          <label>
                            <input type="checkbox" name="abnormal" /> Flag abnormal
                          </label>
                        </>
                      )}
                      <Button variant="outline">{s.replaceAll("_", " ").toLowerCase()}</Button>
                    </form>
                  ))}
              </div>
            </article>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
