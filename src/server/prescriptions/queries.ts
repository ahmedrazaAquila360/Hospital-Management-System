import "server-only";
import { requiresPatientAssignment } from "@/lib/permissions";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const PRESCRIPTIONS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type PrescriptionFilters = { search?: string; dentistId?: string; patientId?: string; page?: number; pageSize?: number };

export async function listPrescriptions(filters: PrescriptionFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const actor = await requireUser();
  const where = { ...(requiresPatientAssignment(actor) && { dentistId: actor.id }),
    AND: [
      filters.search ? { patient: { fullName: { contains: filters.search, mode: "insensitive" as const } } } : {},
      filters.dentistId ? { dentistId: filters.dentistId } : {},
      filters.patientId ? { patientId: filters.patientId } : {},
    ],
  };

  const [total, prescriptions] = await Promise.all([
    prisma.prescription.count({ where }),
    prisma.prescription.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: true, dentist: true, medicines: true },
    }),
  ]);

  return { prescriptions, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPrescriptionById(id: string) {
  const actor = await requireUser();
  return prisma.prescription.findUnique({
    where: { id, ...(requiresPatientAssignment(actor) && { dentistId: actor.id }) },
    include: { patient: true, dentist: true, medicines: true },
  });
}

/** Read-only totals for the Prescriptions summary cards. */
export async function getPrescriptionStats() {
  const actor = await requireUser();
  const where = requiresPatientAssignment(actor) ? { dentistId: actor.id } : {};
  const [total, patients, dentists] = await Promise.all([
    prisma.prescription.count({ where }),
    prisma.prescription.groupBy({ where, by: ["patientId"] }),
    prisma.prescription.groupBy({ where, by: ["dentistId"] }),
  ]);
  return { total, patients: patients.length, dentists: dentists.length };
}
