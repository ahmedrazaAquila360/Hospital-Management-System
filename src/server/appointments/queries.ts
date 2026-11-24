import "server-only";
import { requiresPatientAssignment } from "@/lib/permissions";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import type { AppointmentStatus } from "@/generated/prisma/enums";

export type AppointmentFilters = {
  dentistId?: string;
  status?: AppointmentStatus;
  patientId?: string;
};

export async function listAppointmentsInRange(start: Date, end: Date, filters: AppointmentFilters = {}) {
  const actor = await requireUser();
  return prisma.appointment.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(filters.dentistId ? { dentistId: filters.dentistId } : {}),
      ...(requiresPatientAssignment(actor) && { dentistId: actor.id }),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.patientId ? { patientId: filters.patientId } : {}),
    },
    include: { patient: true, dentist: true },
    orderBy: { startTime: "asc" },
  });
}

export async function getAppointmentById(id: string) {
  const actor = await requireUser();
  return prisma.appointment.findUnique({
    where: { id, ...(requiresPatientAssignment(actor) && { dentistId: actor.id }) },
    include: {
      patient: true,
      dentist: true,
      encounter: { select: { id: true, token: true } },
      createdBy: true,
      treatments: { where: can(actor,"treatments.view") ? {} : { id: { in: [] } } },
      prescriptions: { where: can(actor,"prescriptions.view") ? {} : { id: { in: [] } }, include: { medicines: true } },
    },
  });
}

export async function getDentists() {
  const role = await prisma.role.findUnique({ where: { name: "DENTIST" } });
  if (!role) return [];
  return prisma.user.findMany({ where: { roleId: role.id, status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function searchPatientsForSelect(query: string) {
  const actor = await requireUser();
  return prisma.patient.findMany({
    where: { archivedAt: null, AND: [patientScope(actor), { OR: [
      { fullName: { contains: query, mode: "insensitive" } }, { patientCode: { contains: query, mode: "insensitive" } },
    ] }] }, select: { id: true, patientCode: true, fullName: true, phone: true }, take: 20, orderBy: { fullName: "asc" },
  });
}
