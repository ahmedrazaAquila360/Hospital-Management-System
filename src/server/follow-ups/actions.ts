"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requirePermission} from "@/lib/auth/guard";
import {prisma} from "@/lib/prisma";
import {calendarDay} from "@/lib/report-calendar";
import {hospitalZone} from "@/server/reports/calendar";
import {patientScope} from "@/server/patients/access";
export async function setFollowUpConsent(form:FormData){
 const actor=await requirePermission("patients.edit");const id=z.string().min(1).parse(form.get("patientId"));const consent=form.get("consent")==="on";
 await prisma.$transaction(async tx=>{await tx.patient.update({where:{id,AND:[patientScope(actor)]},data:{reminderConsent:consent}});if(!consent)await tx.followUp.updateMany({where:{patientId:id,status:"DUE"},data:{status:"OPTED_OUT"}});await tx.activityLog.create({data:{userId:actor.id,action:"REMINDER_CONSENT",entityType:"Patient",entityId:id,metadata:{consent}}});});revalidatePath("/follow-ups");
}
export async function updateFollowUp(form:FormData){
 const actor=await requirePermission("appointments.edit");const data=z.object({id:z.string().min(1),status:z.enum(["BOOKED","COMPLETED","OPTED_OUT","CANCELLED"])}).parse(Object.fromEntries(form));
 await prisma.$transaction(async tx=>{const before=await tx.followUp.findFirstOrThrow({where:{id:data.id,patient:patientScope(actor)}});if(before.status!=="DUE"&&before.status!=="BOOKED")throw new Error("Follow-up is no longer open.");await tx.followUp.update({where:{id:data.id,status:before.status},data:{status:data.status}});await tx.activityLog.create({data:{userId:actor.id,action:"FOLLOW_UP",entityType:"FollowUp",entityId:data.id,metadata:{before:before.status,after:data.status}}});});revalidatePath("/follow-ups");
}
export async function generateInternalReminders(){
 const actor=await requirePermission("appointments.edit");const day=calendarDay(await hospitalZone());
 await prisma.$transaction(async tx=>{const due=await tx.followUp.findMany({where:{status:"DUE",dueDate:{lte:new Date(day)},reminderSentAt:null,patient:{AND:[patientScope(actor)],reminderConsent:true}},select:{id:true,patientId:true}});for(const row of due){const changed=await tx.followUp.updateMany({where:{id:row.id,reminderSentAt:null},data:{reminderSentAt:new Date()}});if(changed.count)await tx.notification.create({data:{userId:actor.id,type:"SYSTEM",title:"Follow-up due",message:"A consented patient follow-up is due.",link:"/follow-ups"}});}await tx.activityLog.create({data:{userId:actor.id,action:"GENERATE_REMINDERS",entityType:"FollowUp",metadata:{count:due.length}}});});revalidatePath("/follow-ups");
}
