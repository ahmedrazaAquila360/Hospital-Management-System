import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guard";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { encounterScope } from "@/server/encounters/scope";
import { getClinicSettings } from "@/server/settings/queries";
import { PrintLayout } from "@/components/print/print-layout";

export default async function LabReport({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "lab.view") && !can(user, "opd.view")) notFound();
  const { id } = await params;
  const order = await prisma.labOrder.findFirst({
    where: { id, status: "RELEASED", ...(!can(user, "lab.view") && { encounter: encounterScope(user) }) },
    include: {
      test: true,
      encounter: {
        include: {
          appointment: { include: { patient: true, dentist: true } },
          admission: { include: { patient: true, doctor: true } },
        },
      },
    },
  });
  if (!order) notFound();
  const patient = order.encounter.appointment?.patient ?? order.encounter.admission?.patient;
  const provider = order.encounter.appointment?.dentist ?? order.encounter.admission?.doctor;
  const verifier =
    order.verifiedBy &&
    (await prisma.user.findUnique({ where: { id: order.verifiedBy }, select: { name: true } }));
  return (
    <PrintLayout clinic={await getClinicSettings()} documentLabel="Laboratory report">
      <div className="space-y-4">
        <h2>
          {patient?.fullName} · {patient?.patientCode}
        </h2>
        <p>Ordering doctor · {provider?.name}</p>
        <p>
          Sample · {order.sampleId} · Collected {order.collectedAt?.toLocaleString()}
        </p>
        <h3 className="font-semibold">{order.test.name}</h3>
        <p>{order.result}</p>
        <p>Reference range · {order.referenceRange || "Unspecified"}</p>
        <p>{order.abnormal ? "Flagged abnormal" : "Unflagged"}</p>
        <p>
          Verified by {verifier && verifier.name} · Released {order.releasedAt?.toLocaleString()}
        </p>
      </div>
    </PrintLayout>
  );
}
