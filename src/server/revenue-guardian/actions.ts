"use server";
import {guardianConfigSchema} from "./config";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requirePermission} from "@/lib/auth/guard";
import {prisma} from "@/lib/prisma";
import {scanRevenueGuardian} from "./scan";
import {guardianReviewers} from "./reviewers";
export async function runGuardianScan(){const actor=await requirePermission("billing.guardianManage");await scanRevenueGuardian(actor.id);revalidatePath("/billing/guardian");}
export async function reviewGuardianAlert(form:FormData){
 const actor=await requirePermission("billing.guardian");
 const data=z.object({id:z.string().min(1),status:z.enum(["REVIEWED","DISMISSED"]),assigneeId:z.string().optional(),reason:z.string().trim().max(500).optional()}).parse(Object.fromEntries(form));
 if(data.status==="DISMISSED"&&!data.reason)throw new Error("A dismissal reason is required.");
 const reviewers=await guardianReviewers();
 await prisma.$transaction(async tx=>{
  const before=await tx.revenueAlert.findUniqueOrThrow({where:{id:data.id}});
  if(before.status==="RESOLVED")throw new Error("This alert has reconciled. Refresh.");
  if(data.assigneeId&&!reviewers.some(u=>u.id===data.assigneeId))throw new Error("Reviewer is not authorized for this branch.");
  await tx.revenueAlert.update({where:{id:data.id},data:{status:data.status,assignedToId:data.assigneeId||null,reviewedById:actor.id,reviewedAt:new Date(),dismissedReason:data.status==="DISMISSED"?data.reason:null}});
  await tx.activityLog.create({data:{userId:actor.id,action:data.status,entityType:"RevenueAlert",entityId:data.id,metadata:{before:before.status,after:data.status,reason:data.reason??null,assigneeId:data.assigneeId??null}}});
 });revalidatePath("/billing/guardian");
}

export async function saveGuardianConfig(form:FormData){
 const actor=await requirePermission("billing.guardianManage");
 const optional=(key:string)=>{const value=form.get(key);return value===""||value===null?null:Number(value)};
 const config=guardianConfigSchema.parse({enabled:form.get("enabled")==="on",discountAmount:optional("discountAmount"),discountPercent:optional("discountPercent"),refundAmount:optional("refundAmount"),approvedByOperator:false});
 await prisma.$transaction(async tx=>{
  const settings=await tx.clinicSettings.findFirstOrThrow({select:{id:true,guardianConfig:true}});
  await tx.clinicSettings.update({where:{id:settings.id},data:{guardianConfig:config}});
  await tx.activityLog.create({data:{userId:actor.id,action:"CONFIGURE",entityType:"RevenueGuardian",metadata:{before:settings.guardianConfig??{},after:config}}});
 });revalidatePath("/billing/guardian");
}
