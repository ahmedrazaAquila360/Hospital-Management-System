import 'server-only';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {can,type SessionUser} from '@/lib/permissions';
import {guardianReviewers} from './reviewers';
export async function reviewAlert(input:{id:string;status:'REVIEWED'|'DISMISSED';assigneeId?:string;reason?:string},actor:SessionUser){
 if(!can(actor,'billing.guardian'))throw new Error('Revenue Guardian access required.');
 const data=z.object({id:z.string().min(1),status:z.enum(['REVIEWED','DISMISSED']),assigneeId:z.string().optional(),reason:z.string().trim().max(500).optional()}).parse(input);
 if(data.status==='DISMISSED'&&!data.reason)throw new Error('A dismissal reason is required.');
 const reviewers=await guardianReviewers();
 return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT id FROM "RevenueAlert" WHERE id=${data.id} FOR UPDATE`;
 const before=await tx.revenueAlert.findUniqueOrThrow({where:{id:data.id}});if(before.status==='RESOLVED')throw new Error('This alert has reconciled. Refresh.');
 if(data.assigneeId&&!reviewers.some(u=>u.id===data.assigneeId))throw new Error('Reviewer is not authorized for this branch.');
 const row=await tx.revenueAlert.update({where:{id:data.id},data:{status:data.status,assignedToId:data.assigneeId||null,reviewedById:actor.id,reviewedAt:new Date(),dismissedReason:data.status==='DISMISSED'?data.reason:null}});
 await tx.activityLog.create({data:{userId:actor.id,action:data.status,entityType:'RevenueAlert',entityId:data.id,metadata:{before:before.status,after:data.status,reason:data.reason??null,assigneeId:data.assigneeId??null}}});return row;
 });
}
