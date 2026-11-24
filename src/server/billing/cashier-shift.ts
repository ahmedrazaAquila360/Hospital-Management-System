import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/** Called inside the payment transaction so closing and posting serialize on the shift row. */
export async function activeCashierShift(tx: Prisma.TransactionClient, userId: string, required: boolean) {
  const shift = await tx.cashierShift.findFirst({where:{cashierId:userId,status:"OPEN"},select:{id:true}});
  if (!shift) {
    if (required) throw new Error("Open a cashier shift before posting a payment.");
    return null;
  }
  await tx.$queryRaw`SELECT id FROM "CashierShift" WHERE id=${shift.id} FOR UPDATE`;
  const open = await tx.cashierShift.findFirst({where:{id:shift.id,status:"OPEN"},select:{id:true}});
  if (!open) throw new Error("The cashier shift has closed. Reopen the payment form.");
  return open.id;
}
