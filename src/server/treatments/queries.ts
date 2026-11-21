import "server-only";
import { requireUser } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { TreatmentStatus } from "@/generated/prisma/enums";

export const TREATMENTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type TreatmentFilters = {
  search?: string;
  status?: TreatmentStatus;
  dentistId?: string;
  patientId?: string;
  /** Start date order; default is newest created first. */
  sort?: "date_asc" | "date_desc";
  page?: number;
  pageSize?: number;
};

export async function listTreatments(filters: TreatmentFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const actor = await requireUser();
  const where = { patient: patientScope(actor),
    AND: [
      filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" as const } },
              { patient: { fullName: { contains: filters.search, mode: "insensitive" as const } } },
            ],
          }
        : {},
      filters.status ? { status: filters.status } : {},
      filters.dentistId ? { dentistId: filters.dentistId } : {},
      filters.patientId ? { patientId: filters.patientId } : {},
    ],
  };

  const [total, treatments] = await Promise.all([
    prisma.treatment.count({ where }),
    prisma.treatment.findMany({
      where,
      orderBy:
        filters.sort === "date_asc"
          ? [{ startDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }]
          : filters.sort === "date_desc"
            ? [{ startDate: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }]
            : { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { patient: true, dentist: true, teeth: { include: { tooth: true } } },
    }),
  ]);

  return { treatments, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getTreatmentById(id: string) {
  const actor = await requireUser();
  return prisma.treatment.findUnique({
    where: { id, patient: patientScope(actor) },
    include: {
      patient: true,
      dentist: true,
      appointment: true,
      teeth: { include: { tooth: true } },
      invoiceItems: { include: { invoice: true } },
    },
  });
}

/** Read-only totals for the Treatments summary cards. */
export async function getTreatmentCounts() {
  const grouped = await prisma.treatment.groupBy({ by: ["status"], _count: { _all: true } });
  const count = (status: TreatmentStatus) => grouped.find((g) => g.status === status)?._count._all ?? 0;
  const total = grouped.reduce((sum, g) => sum + g._count._all, 0);
  return { total, planned: count("PLANNED"), inProgress: count("IN_PROGRESS"), completed: count("COMPLETED"), cancelled: count("CANCELLED") };
}
