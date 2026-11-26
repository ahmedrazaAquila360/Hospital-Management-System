import 'server-only';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {can,type SessionUser} from '@/lib/permissions';
import {patientScope} from '@/server/patients/access';
export async function changeReminderConsent(id:string,consent:boolean,actor:SessionUser){
 if(!can(actor,'patients.edit'))throw new Error('Patient edit permission required.');z.string().min(1).parse(id);
 return prisma.$transaction(async tx=>{await tx.patient.update({where:{id,AND:[patientScope(actor)]},data:{reminderConsent:consent}});if(!consent)await tx.followUp.updateMany({where:{patientId:id,status:'DUE'},data:{status:'OPTED_OUT'}});await tx.activityLog.create({data:{userId:actor.id,action:'REMINDER_CONSENT',entityType:'Patient',entityId:id,metadata:{consent}}});});
}
export async function changeFollowUp(input:{id:string;status:'BOOKED'|'COMPLETED'|'OPTED_OUT'|'CANCELLED'},actor:SessionUser){
 if(!can(actor,'appointments.edit'))throw new Error('Appointment edit permission required.');const data=z.object({id:z.string().min(1),status:z.enum(['BOOKED','COMPLETED','OPTED_OUT','CANCELLED'])}).parse(input);
 return prisma.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "FollowUp" WHERE id=${data.id} FOR UPDATE`;const before=await tx.followUp.findFirstOrThrow({where:{id:data.id,patient:patientScope(actor)}});if(!['DUE','BOOKED'].includes(before.status))throw new Error('Follow-up is no longer open.');await tx.followUp.update({where:{id:data.id,status:before.status},data:{status:data.status}});await tx.activityLog.create({data:{userId:actor.id,action:'FOLLOW_UP',entityType:'FollowUp',entityId:data.id,metadata:{before:before.status,after:data.status}}});});
}
