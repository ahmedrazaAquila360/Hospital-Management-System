import 'server-only';
import {prisma,requestBranch} from '@/lib/prisma';
import {can,type SessionUser} from '@/lib/permissions';
import {z} from 'zod';
export async function changeAttendance(input:{action:'IN'|'OUT'|'PLAN'|'CORRECT';id?:string;userId?:string;start?:Date;end?:Date;reason?:string},actor:SessionUser){
 const manage=can(actor,'attendance.manage');if(!can(actor,'attendance.view'))throw new Error('Attendance access required.');
 if(['PLAN','CORRECT'].includes(input.action)&&!manage)throw new Error('Attendance management permission required.');
 const branchId=await requestBranch();const userId=input.action==='PLAN'?z.string().min(1).parse(input.userId):actor.id;
 return prisma.$transaction(async tx=>{
 await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'attendance:'+userId},0))::text`;
 if(input.action==='PLAN'){
 await tx.user.findFirstOrThrow({where:{id:userId,status:'ACTIVE',branchMemberships:{some:{branchId,active:true}}},select:{id:true}});
 z.date().parse(input.start);z.date().parse(input.end);if(input.end!<=input.start!)throw new Error('Shift end must follow start.');
 if(await tx.attendanceShift.findFirst({where:{userId,scheduledStart:{lt:input.end},scheduledEnd:{gt:input.start}}}))throw new Error('Scheduled shifts overlap.');
 const row=await tx.attendanceShift.create({data:{userId,scheduledStart:input.start,scheduledEnd:input.end}});
 await tx.activityLog.create({data:{userId:actor.id,action:'CREATE',entityType:'AttendanceShift',entityId:row.id,metadata:{scheduledStart:input.start!.toISOString(),scheduledEnd:input.end!.toISOString(),staffId:userId}}});return row;
 }
 if(input.action==='IN'){
 const open=await tx.attendanceShift.findFirst({where:{userId,checkedInAt:{not:null},checkedOutAt:null}});if(open)return open;
 const planned=input.id?await tx.attendanceShift.findFirstOrThrow({where:{id:input.id,userId,checkedInAt:null}}):null;
 const row=planned?await tx.attendanceShift.update({where:{id:planned.id},data:{checkedInAt:new Date()}}):await tx.attendanceShift.create({data:{userId,checkedInAt:new Date()}});
 await tx.activityLog.create({data:{userId:actor.id,action:'CHECK_IN',entityType:'AttendanceShift',entityId:row.id,metadata:{checkedInAt:row.checkedInAt!.toISOString()}}});return row;
 }
 if(!input.id)throw new Error('Select a shift.');
 await tx.$queryRaw`SELECT id FROM "AttendanceShift" WHERE id=${input.id} FOR UPDATE`;
 const before=await tx.attendanceShift.findFirstOrThrow({where:{id:input.id,...(input.action==='OUT'?{userId}:{})}});
 let data:{checkedInAt?:Date;checkedOutAt:Date};
 if(input.action==='OUT'){if(!before.checkedInAt)throw new Error('Check in first.');if(before.checkedOutAt)return before;data={checkedOutAt:new Date()};}
 else{z.string().trim().min(3).max(1000).parse(input.reason);z.date().max(new Date()).parse(input.start);z.date().max(new Date()).parse(input.end);if(input.end!<input.start!)throw new Error('Check out must follow check in.');data={checkedInAt:input.start,checkedOutAt:input.end!};}
 const row=await tx.attendanceShift.update({where:{id:before.id},data});
 await tx.activityLog.create({data:{userId:actor.id,action:input.action==='OUT'?'CHECK_OUT':'CORRECT',entityType:'AttendanceShift',entityId:row.id,metadata:{before:{checkedInAt:before.checkedInAt?.toISOString()??null,checkedOutAt:before.checkedOutAt?.toISOString()??null},after:{checkedInAt:row.checkedInAt?.toISOString()??null,checkedOutAt:row.checkedOutAt?.toISOString()??null},reason:input.reason??null}}});return row;
 });
}
