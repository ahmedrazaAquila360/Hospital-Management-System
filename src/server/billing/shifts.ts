"use server";

import {randomUUID} from "node:crypto";
import {revalidatePath} from "next/cache";
import {Prisma} from "@/generated/prisma/client";
import {requirePermission} from "@/lib/auth/guard";
import {prisma} from "@/lib/prisma";
import {z} from "zod";

const amount=z.string().regex(/^\d{1,8}(\.\d{1,2})?$/);

export async function openCashierShift(form:FormData){
 const actor=await requirePermission("billing.shifts");
 const openingCash=new Prisma.Decimal(amount.parse(form.get("openingCash")));
 await prisma.$transaction(async tx=>{
  const prior=await tx.cashierShift.findFirst({where:{cashierId:actor.id,status:"OPEN"}});
  if(prior)throw new Error("Close your current shift before opening another.");
  const shift=await tx.cashierShift.create({data:{id:randomUUID(),cashierId:actor.id,openingCash}});
  await tx.activityLog.create({data:{userId:actor.id,action:"OPEN",entityType:"CashierShift",entityId:shift.id,metadata:{openingCash:openingCash.toFixed(2)}}});
 });revalidatePath("/billing/shifts");
}

export async function submitCashierShift(form:FormData){
 const actor=await requirePermission("billing.shifts");
 const id=z.string().min(1).parse(form.get("id"));
 const countedCash=new Prisma.Decimal(amount.parse(form.get("countedCash")));
 await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "CashierShift" WHERE id=${id} FOR UPDATE`;
  const shift=await tx.cashierShift.findFirstOrThrow({where:{id,cashierId:actor.id,status:"OPEN"},include:{payments:{select:{amount:true,method:true}}}});
  const cash=shift.payments.filter(p=>p.method==="CASH").reduce((sum,p)=>sum.plus(p.amount),new Prisma.Decimal(0));
  const expectedCash=shift.openingCash.plus(cash);
  const discrepancy=countedCash.minus(expectedCash);
  await tx.cashierShift.update({where:{id},data:{status:"SUBMITTED",submittedAt:new Date(),countedCash,expectedCash,discrepancy}});
  await tx.activityLog.create({data:{userId:actor.id,action:"SUBMIT",entityType:"CashierShift",entityId:id,metadata:{countedCash:countedCash.toFixed(2),expectedCash:expectedCash.toFixed(2),discrepancy:discrepancy.toFixed(2),payments:shift.payments.length}}});
 });revalidatePath("/billing/shifts");
}

export async function approveCashierShift(form:FormData){
 const actor=await requirePermission("billing.shiftApprove");
 if(!["ADMIN","SUPER_ADMIN"].includes(actor.role.name))throw new Error("Administrator approval is required until hospital closing policy is approved.");
 const id=z.string().min(1).parse(form.get("id"));
 const reason=z.string().trim().max(500).parse(form.get("reason")??"");
 await prisma.$transaction(async tx=>{
  const shift=await tx.cashierShift.findFirstOrThrow({where:{id,status:"SUBMITTED"}});
  if(shift.discrepancy && !shift.discrepancy.isZero() && !reason)throw new Error("Explain the cash discrepancy before approval.");
  await tx.cashierShift.update({where:{id,status:"SUBMITTED"},data:{status:"APPROVED",approvedAt:new Date(),approvedById:actor.id}});
  await tx.activityLog.create({data:{userId:actor.id,action:"APPROVE",entityType:"CashierShift",entityId:id,metadata:{reason,discrepancy:shift.discrepancy?.toFixed(2)}}});
 });revalidatePath("/billing/shifts");
}
