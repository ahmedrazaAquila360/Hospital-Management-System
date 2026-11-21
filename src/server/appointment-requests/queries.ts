import "server-only";
import { prisma } from "@/lib/prisma";
import type { RequestStatus } from "@/generated/prisma/enums";

export async function listAppointmentRequests(status: RequestStatus = "PENDING") {
  const requests = await prisma.appointmentRequest.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
  });

  const dentistIds = [...new Set(requests.map((r) => r.preferredDentistId).filter((id): id is string => Boolean(id)))];
  const dentists = dentistIds.length
    ? await prisma.user.findMany({ where: { id: { in: dentistIds } }, select: { id: true, name: true } })
    : [];
  const dentistById = new Map(dentists.map((d) => [d.id, d.name]));

  return requests.map((r) => ({ ...r, preferredDentistName: r.preferredDentistId ? (dentistById.get(r.preferredDentistId) ?? null) : null }));
}

export async function countPendingRequests() {
  return prisma.appointmentRequest.count({ where: { status: "PENDING" } });
}
