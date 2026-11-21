import "server-only";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";

export const STAFF_PAGE_SIZE = DEFAULT_PAGE_SIZE;

export type StaffFilters = { search?: string; roleName?: string; page?: number; pageSize?: number };

export async function listStaff(filters: StaffFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE;
  const where = {
    AND: [
      filters.search
        ? {
            OR: [
              { name: { contains: filters.search, mode: "insensitive" as const } },
              { email: { contains: filters.search, mode: "insensitive" as const } },
            ],
          }
        : {},
      filters.roleName ? { role: { name: filters.roleName } } : {},
    ],
  };

  const [total, staff] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { role: true },
    }),
  ]);

  return { staff, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getStaffById(id: string) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

export async function getRoles() {
  return prisma.role.findMany({ orderBy: { name: "asc" } });
}

/** Read-only counts for the Staff summary cards and the role filter. */
export async function getStaffStats() {
  const [total, active, roles] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.role.findMany({ orderBy: { label: "asc" }, select: { name: true, label: true, _count: { select: { users: true } } } }),
  ]);
  return {
    total,
    active,
    inactive: total - active,
    roles: roles.map((r) => ({ name: r.name, label: r.label, count: r._count.users })),
  };
}
