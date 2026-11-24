import "server-only";
import { requireUser } from "@/lib/auth/guard";
import { patientScope } from "@/server/patients/access";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import type { DocumentType } from "@/generated/prisma/enums";

export const DOCUMENTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type DocumentFilters = { search?: string; type?: DocumentType; patientId?: string; page?: number; pageSize?: number };

export async function listDocuments(filters: DocumentFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const actor = await requireUser();
  const where = { ...(actor.role.name === "DENTIST" && { patient: patientScope(actor) }),
    AND: [
      filters.search ? { name: { contains: filters.search, mode: "insensitive" as const } } : {},
      filters.type ? { type: filters.type } : {},
      filters.patientId ? { patientId: filters.patientId } : {},
    ],
  };

  const [total, documents] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      orderBy: { uploadedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { uploadedBy: true, patient: true },
    }),
  ]);

  return { documents, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Read-only counts for the Documents summary cards. */
export async function getDocumentStats() {
  const actor = await requireUser();
  const byType = await prisma.document.groupBy({ where: actor.role.name === "DENTIST" ? { patient: patientScope(actor) } : {}, by: ["type"], _count: { _all: true } });
  const count = (t: DocumentType) => byType.find((r) => r.type === t)?._count._all ?? 0;
  const total = byType.reduce((sum, r) => sum + r._count._all, 0);
  return { total, xray: count("XRAY"), report: count("REPORT"), image: count("IMAGE"), other: total - count("XRAY") - count("REPORT") - count("IMAGE") };
}

/** Patients who have at least one document, for the patient filter. */
export async function getDocumentPatients() {
  const actor = await requireUser();
  return prisma.patient.findMany({
    where: { AND: [patientScope(actor)], documents: { some: {} } },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });
}
