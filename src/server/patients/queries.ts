import "server-only";
import { patientScope } from "./access";
import { can } from "@/lib/permissions";
import { requireUser } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { toNumber } from "@/lib/format";
import type { Gender } from "@/generated/prisma/enums";

export const PATIENTS_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type PatientListFilters = {
  search?: string;
  gender?: Gender;
  dentistId?: string;
  sort?: "name_asc" | "name_desc" | "recent" | "oldest";
  page?: number;
  pageSize?: number;
};

export async function listPatients(filters: PatientListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const actor = await requireUser();
  const where = { archivedAt: null,
    AND: [patientScope(actor),
      filters.search
        ? {
            OR: [
              { fullName: { contains: filters.search, mode: "insensitive" as const } },
              { patientCode: { contains: filters.search, mode: "insensitive" as const } },
              { phone: { contains: filters.search, mode: "insensitive" as const } },
              { email: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {},
      filters.gender ? { gender: filters.gender } : {},
      filters.dentistId
        ? { OR: [{ appointments: { some: { dentistId: filters.dentistId } } }, { treatments: { some: { dentistId: filters.dentistId } } }] }
        : {},
    ],
  };

  const orderBy =
    filters.sort === "name_desc"
      ? { fullName: "desc" as const }
      : filters.sort === "oldest"
        ? { createdAt: "asc" as const }
        : filters.sort === "name_asc"
          ? { fullName: "asc" as const }
          : { createdAt: "desc" as const };

  const [total, patients] = await Promise.all([
    prisma.patient.count({ where }),
    prisma.patient.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        appointments: {
          orderBy: { date: "desc" },
          take: 1,
          include: { dentist: true },
        },
        treatments: {
          select: { status: true, dentist: true, cost: true, discount: true },
        },
        invoices: {
          where: can(actor,"billing.view") ? {} : { id: { in: [] } },
          select: { total: true, payments: { select: { amount: true } } },
        },
      },
    }),
  ]);

  const rows = patients.map((p) => {
    const lastAppointment = p.appointments[0];
    const activeTreatment = p.treatments.find((t) => t.status === "IN_PROGRESS") ?? p.treatments.find((t) => t.status === "PLANNED");
    const treatmentStatus = activeTreatment?.status ?? (p.treatments.some((t) => t.status === "COMPLETED") ? "COMPLETED" : "NONE");
    const dentist = lastAppointment?.dentist ?? activeTreatment?.dentist ?? null;

    const outstandingBalance = p.invoices.reduce((sum, inv) => {
      const paid = inv.payments.reduce((s, pay) => s + toNumber(pay.amount), 0);
      return sum + Math.max(0, toNumber(inv.total) - paid);
    }, 0);

    return {
      id: p.id,
      patientCode: p.patientCode,
      fullName: p.fullName,
      photoUrl: p.photoUrl,
      phone: p.phone,
      dob: p.dob,
      gender: p.gender,
      lastVisit: lastAppointment?.date ?? null,
      dentist: dentist?.name ?? null,
      treatmentStatus,
      outstandingBalance,
    };
  });

  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getPatientById(id: string) {
  const actor = await requireUser();
  return prisma.patient.findUnique({
    where: { id, AND: [patientScope(actor)] },
    include: {
      createdBy: true,
      medicalHistory: true,
      dentalRecord: { include: { teeth: { where: { toothNumber: { lte: 48 } }, orderBy: { toothNumber: "asc" }, include: { conditions: { orderBy: { recordedAt: "desc" }, include: { recordedBy: true } } } } } },
      appointments: { where: can(actor,"appointments.view") ? {} : { id: { in: [] } }, orderBy: { date: "desc" }, include: { dentist: true } },
      treatments: { where: can(actor,"treatments.view") ? {} : { id: { in: [] } }, orderBy: { createdAt: "desc" }, include: { dentist: true, teeth: { include: { tooth: true } } } },
      prescriptions: { where: can(actor,"prescriptions.view") ? {} : { id: { in: [] } }, orderBy: { date: "desc" }, include: { dentist: true, medicines: true } },
      documents: { where: can(actor,"documents.view") ? {} : { id: { in: [] } }, orderBy: { uploadedAt: "desc" }, include: { uploadedBy: true } },
      invoices: { where: can(actor,"billing.view") ? {} : { id: { in: [] } }, orderBy: { date: "desc" }, include: { items: true, payments: true } },
    },
  });
}

export async function getDentistOptions() {
  const role = await prisma.role.findUnique({ where: { name: "DENTIST" } });
  if (!role) return [];
  return prisma.user.findMany({ where: { roleId: role.id, status: "ACTIVE" }, orderBy: { name: "asc" } });
}
