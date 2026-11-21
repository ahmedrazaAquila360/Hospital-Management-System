import { Pill } from "lucide-react";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dispense, receive, returnStock, adjustStock } from "./actions";

export default async function Pharmacy() {
  const user = await requirePermission("pharmacy.view");
  const settings = await prisma.clinicSettings.findFirst({ select: { timeZone:true } });
  const today = new Date(new Intl.DateTimeFormat("en-CA",{ timeZone:settings?.timeZone ?? "UTC",year:"numeric",month:"2-digit",day:"2-digit" }).format(new Date()));
  const expiryWarning = today.getTime() + 90 * 86400000;
  const stock = await prisma.pharmacyBatch.findMany({
    include: { medication: true },
    orderBy: { expiry: "asc" },
  });
  const pending = can(user, "pharmacy.edit")
    ? await prisma.prescriptionMedicine.findMany({
        where: { fills: { none: {} } },
        include: {
          prescription: {
            include: { patient: { select: { fullName: true, patientCode: true, allergies: true } } },
          },
        },
      })
    : [];
  const fills = can(user, "pharmacy.edit")
    ? await prisma.dispensing.findMany({
        include: {
          invoice: { select: { invoiceNumber: true } },
          medicine: { select: { medicineName: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];
  return (
    <div className="space-y-6">
      <PageHeader title="Pharmacy" icon={<Pill />} />
      {can(user, "pharmacy.manage") && (
        <Card>
          <CardHeader>
            <CardTitle>Receive stock</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={receive} className="grid gap-3 sm:grid-cols-3">
              {[
                "generic",
                "brand",
                "strength",
                "form",
                "category",
                "lot",
                "supplier",
                "expiry",
                "purchase",
                "price",
                "quantity",
              ].map((k) => (
                <label className="capitalize" key={k}>
                  {k === "price" ? "Selling price" : k}
                  <Input
                    name={k}
                    required
                    type={
                      k === "expiry"
                        ? "date"
                        : ["purchase", "quantity", "price"].includes(k)
                          ? "number"
                          : "text"
                    }
                    step={k === "quantity" ? "1" : ".01"}
                    min={k === "quantity" ? 1 : 0}
                  />
                </label>
              ))}
              <Button>Receive stock</Button>
            </form>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Batch inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!stock.length && <p>No batches received.</p>}
          {stock.map((b) => (
            <div key={b.id}><p>
              {b.medication.generic} · {b.medication.brand} {b.medication.strength} · {b.lot} · Expiry{" "}
              {b.expiry.toISOString().slice(0, 10)} · {b.quantity} units {b.quantity < 10 && "· Low stock"}
              {b.expiry < today ? " · Expired" : b.expiry.getTime() <= expiryWarning ? " · Expires within 90 days" : ""}
            </p>{can(user,"pharmacy.manage") && <details><summary>Adjust stock</summary><form action={adjustStock} className="flex flex-wrap gap-2">
              <input type="hidden" name="batchId" value={b.id}/><input type="hidden" name="expected" value={b.quantity}/><label>Counted units<Input type="number" name="counted" min="0" required /></label><label>Reason<Input name="reason" required/></label><Button variant="outline">Save adjustment</Button></form></details>}</div>
          ))}
        </CardContent>
      </Card>
      {fills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Medicine returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {fills
              .filter((f) => f.returned < f.quantity)
              .map((f) => (
                <form key={f.id} action={returnStock} className="space-y-2">
                  <p>
                    {f.medicine.medicineName} · {f.invoice.invoiceNumber} · {f.quantity - f.returned} units
                    eligible
                  </p>
                  <input type="hidden" name="fillId" value={f.id} />
                  <label>
                    Quantity
                    <Input type="number" name="quantity" min="1" max={f.quantity - f.returned} required />
                  </label>
                  <label>
                    Return reason
                    <Input name="reason" required />
                  </label>
                  <label className="block">
                    <input name="restock" type="checkbox" /> Inspected and suitable to return to stock
                  </label>
                  <Button variant="outline">Credit return</Button>
                </form>
              ))}
          </CardContent>
        </Card>
      )}
      {can(user, "pharmacy.edit") && (
        <Card>
          <CardHeader>
            <CardTitle>Prescription dispensing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!pending.length && <p>No prescriptions awaiting dispensing.</p>}
            {pending.map((rx) => {
              const matches = stock.filter(
                (b) =>
                  b.expiry >= today && b.quantity &&
                  [b.medication.generic, b.medication.brand].some(
                    (v) => v.toLowerCase() === rx.medicineName.toLowerCase(),
                  ),
              );
              return (
                <form action={dispense} key={rx.id} className="space-y-3 border-t py-3">
                  <h3 className="font-semibold">
                    {rx.prescription.patient.fullName} · {rx.prescription.patient.patientCode}
                  </h3>
                  <p>
                    {rx.medicineName} · {rx.dosage} · {rx.frequency} · {rx.duration} · {rx.instructions}
                  </p>
                  <p>Recorded allergies · {rx.prescription.patient.allergies || "No information recorded"}</p>
                  <input type="hidden" name="medicineId" value={rx.id} />
                  <label>
                    Batch{" "}
                    <select required name="batchId">
                      {matches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.medication.brand} {b.medication.strength} {b.medication.form} · {b.lot} · Exp{" "}
                          {b.expiry.toISOString().slice(0, 10)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    Quantity
                    <Input name="quantity" required type="number" step="1" min="1" />
                  </label>
                  <label className="block">
                    <input name="verified" type="checkbox" required /> I verified the prescription, medicine,
                    strength, form, quantity and recorded allergies.
                  </label>
                  <Button disabled={!matches.length}>Dispense and invoice</Button>
                </form>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
