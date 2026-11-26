import 'server-only';
import {can,type SessionUser} from '@/lib/permissions';
import {prisma} from '@/lib/prisma';
import {patientScope} from '@/server/patients/access';
import {toothUpdateSchema} from '@/lib/validations/dental-chart';
export async function recordToothCondition(input:{toothId:string;condition:string;notes?:string;surface?:string},user:SessionUser):Promise<{success:boolean;error?:string;patientId?:string}>{
 if(!can(user,'dental_chart.edit'))return {success:false,error:"You don't have permission to do that."};
 const parsed=toothUpdateSchema.safeParse(input);if(!parsed.success)return {success:false,error:parsed.error.issues[0]?.message??'Invalid input.'};
 const {toothId,condition,notes,surface}=parsed.data;
 return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "Tooth" WHERE id=${toothId} FOR UPDATE`;
 const tooth=await tx.tooth.findUnique({where:{id:toothId,dentalRecord:{patient:patientScope(user)}},include:{dentalRecord:{include:{patient:true}}}});
 if(!tooth)return {success:false,error:'Tooth not found.'};
 await tx.tooth.update({where:{id:toothId,dentalRecord:{patient:patientScope(user)}},data:{currentCondition:condition,notes:notes||null}});
 await tx.dentalCondition.create({data:{toothId,condition,notes:notes||null,surface:surface||null,recordedById:user.id}});
 await tx.activityLog.create({data:{userId:user.id,action:'UPDATE',entityType:'Tooth',entityId:toothId,description:`${user.name} set tooth ${tooth.toothNumber} to ${condition} for ${tooth.dentalRecord.patient.fullName}.`,metadata:{before:tooth.currentCondition,after:condition}}});
 return {success:true,patientId:tooth.dentalRecord.patientId};
 });
}
