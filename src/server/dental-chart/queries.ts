import "server-only";
import { requireUser } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";

export async function getDentalChartForPatient(patientId: string) {
  const actor = await requireUser();
  const patient = await prisma.patient.findUnique({
    where: { id: patientId, AND: [patientScope(actor)] },
    include: {
      dentalRecord: {
        include: {
          teeth: {
            // The odontogram is the permanent dentition; primary teeth live on treatments only.
            where: { toothNumber: { lte: 48 } },
            orderBy: { toothNumber: "asc" },
            include: {
              conditions: {
                orderBy: { recordedAt: "desc" },
                include: { recordedBy: true },
              },
              // Only what the chart shows — avoids sending Decimal cost fields to client components.
              treatmentTeeth: {
                include: {
                  treatment: {
                    select: { id: true, name: true, status: true, createdAt: true, startDate: true, completedAt: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return patient;
}

/** Treatments for the chart's Procedures/History tabs, with money fields as plain numbers. */
export async function getChartTreatments(patientId: string) {
  const actor = await requireUser();
  const treatments = await prisma.treatment.findMany({
    where: { patientId, patient: patientScope(actor) },
    orderBy: { createdAt: "desc" },
    include: {
      dentist: { select: { name: true } },
      teeth: { include: { tooth: { select: { toothNumber: true } } } },
    },
  });
  return treatments.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    status: t.status,
    cost: Number(t.cost),
    discount: Number(t.discount),
    startDate: t.startDate,
    expectedCompletionDate: t.expectedCompletionDate,
    completedAt: t.completedAt,
    createdAt: t.createdAt,
    dentistName: t.dentist.name,
    toothNumbers: t.teeth.map((tt) => tt.tooth.toothNumber).sort((a, b) => a - b),
  }));
}

export type ChartTreatment = Awaited<ReturnType<typeof getChartTreatments>>[number];
