import type { SessionUser } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export function patientScope(actor: SessionUser): Prisma.PatientWhereInput {
  if (actor.role.name !== "DENTIST") return {};
  return {
    OR: [
      { createdById: actor.id },
      { appointments: { some: { dentistId: actor.id } } },
      { admissions: { some: { doctorId: actor.id } } },
    ],
  };
}
