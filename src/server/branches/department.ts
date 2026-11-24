import type { Prisma } from "@/generated/prisma/client";
export async function doctorDepartment(tx: Prisma.TransactionClient, userId: string, legacyId?: string | null) {
  const membership = await tx.branchMembership.findFirst({where: {userId, active: true}, select: {departmentId: true}});
  const id = membership?.departmentId ?? legacyId;
  return id ? tx.department.findFirst({where: {id, active: true}}) : null;
}
