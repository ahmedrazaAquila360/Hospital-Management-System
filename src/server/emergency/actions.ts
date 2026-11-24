"use server";

import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requirePermission} from "@/lib/auth/guard";
import {prisma,requestBranch} from "@/lib/prisma";
import {updateEmergencyCase} from "./transaction";

export async function saveDraftTriageCategory(form:FormData){
 const actor=await requirePermission("emergency.manage");
 const data=z.object({name:z.string().trim().min(2).max(80),priority:z.coerce.number().int().min(1).max(99),color:z.string().regex(/^#[0-9a-fA-F]{6}$/),escalationRule:z.string().trim().max(1000)}).parse(Object.fromEntries(form));
 const branchId=await requestBranch();
 await prisma.$transaction(async tx=>{
  const existing=await tx.triageCategory.findUnique({where:{branchId_name:{branchId,name:data.name}}});
  if(existing?.active)throw new Error("An approved active category cannot be overwritten by a draft.");
  const category=await tx.triageCategory.upsert({where:{branchId_name:{branchId,name:data.name}},create:{...data,active:false},update:{priority:data.priority,color:data.color,escalationRule:data.escalationRule}});
  await tx.activityLog.create({data:{userId:actor.id,action:"DRAFT",entityType:"TriageCategory",entityId:category.id,metadata:{name:data.name,priority:data.priority,active:false}}});
 });revalidatePath("/emergency");
}

export async function registerEmergency(form:FormData){
 const actor=await requirePermission("emergency.create");
 const data=z.object({patientId:z.string().min(1),presentingConcern:z.string().trim().min(2).max(2000)}).parse(Object.fromEntries(form));
 await prisma.$transaction(async tx=>{
  await tx.patient.findFirstOrThrow({where:{id:data.patientId,archivedAt:null},select:{id:true}});
  const row=await tx.emergencyCase.create({data:{...data,recordedById:actor.id}});
  await tx.activityLog.create({data:{userId:actor.id,action:"REGISTER",entityType:"EmergencyCase",entityId:row.id,metadata:{patientId:data.patientId}}});
 });revalidatePath("/emergency");
}

export async function updateEmergency(form:FormData){
 const actor=await requirePermission("emergency.edit");
 const data=z.object({id:z.string().min(1),clinicianId:z.string().optional(),categoryId:z.string().optional(),transferType:z.enum(["NONE","OPD","IPD","CLOSE"]),targetId:z.string().optional()}).parse(Object.fromEntries(form));
 await updateEmergencyCase(data,actor);
 revalidatePath("/emergency");
}
