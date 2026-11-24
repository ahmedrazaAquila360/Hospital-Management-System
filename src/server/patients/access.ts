import { requiresPatientAssignment } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export function patientScope(actor: SessionUser): Prisma.PatientWhereInput {
  if (!requiresPatientAssignment(actor)) return {};
  return {
    OR: [
      { createdById: actor.id },
      { appointments: { some: { dentistId: actor.id } } },
      { admissions: { some: { doctorId: actor.id } } },
    ],
  };
}
