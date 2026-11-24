"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requirePermission} from "@/lib/auth/guard";
import {prisma} from "@/lib/prisma";
import {scanRevenueGuardian} from "./scan";
export async function runGuardianScan(){const actor=await requirePermission("billing.guardianManage");await scanRevenueGuardian(actor.id);revalidatePath("/billing/guardian");}
export async function reviewGuardianAlert(form:FormData){
 const actor=await requirePermission("billing.guardian");
 const data=z.object({id:z.string().min(1),status:z.enum(["REVIEWED","DISMISSED"]),reason:z.string().trim().max(500).optional()}).parse(Object.fromEntries(form));
 if(data.status==="DISMISSED"&&!data.reason)throw new Error("A dismissal reason is required.");
 await prisma.$transaction(async tx=>{
  const before=await tx.revenueAlert.findUniqueOrThrow({where:{id:data.id}});
  if(before.status==="RESOLVED")throw new Error("This alert has reconciled. Refresh.");
  await tx.revenueAlert.update({where:{id:data.id},data:{status:data.status,reviewedById:actor.id,reviewedAt:new Date(),dismissedReason:data.status==="DISMISSED"?data.reason:null}});
  await tx.activityLog.create({data:{userId:actor.id,action:data.status,entityType:"RevenueAlert",entityId:data.id,metadata:{before:before.status,after:data.status,reason:data.reason??null}}});
 });revalidatePath("/billing/guardian");
}
