import { can, type SessionUser } from "@/lib/permissions";
import type { Prisma } from "@/generated/prisma/client";

export function encounterScope(
  user: SessionUser,
  patientId?: string,
  active = false,
): Prisma.EncounterWhereInput {
  const all = can(user, "opd.manage");
  return {
    OR: [
      {
        appointment: {
          is: {
            patientId,
            ...(all ? {} : { dentistId: user.id }),
            ...(active && { status: { in: ["CHECKED_IN", "IN_PROGRESS"] } }),
          },
        },
      },
      {
        admission: {
          is: { patientId, ...(all ? {} : { doctorId: user.id }), ...(active && { dischargedAt: null }) },
        },
      },
    ],
  };
}
