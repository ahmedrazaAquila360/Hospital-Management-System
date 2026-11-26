import 'dotenv/config';
import assert from 'node:assert/strict';
import {prisma} from '../src/lib/prisma';
import {basePrisma} from '../src/lib/prisma-base';
import {changeAttendance} from '../src/server/attendance/service';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};
 const own={...actor,permissions:['attendance.view'] as SessionUser['permissions']};const ids:string[]=[];
 try{
 const planned=await changeAttendance({action:'PLAN',userId:u.id,start:new Date('2020-01-01T08:00Z'),end:new Date('2020-01-01T16:00Z')},actor);ids.push(planned.id);
 await assert.rejects(changeAttendance({action:'PLAN',userId:u.id,start:new Date('2020-01-01T09:00Z'),end:new Date('2020-01-01T12:00Z')},actor));
 await assert.rejects(changeAttendance({action:'PLAN',userId:u.id,start:new Date(),end:new Date()},own));
 const results=await Promise.all(Array.from({length:5},()=>changeAttendance({action:'IN',id:planned.id},own)));assert.equal(new Set(results.map(r=>r.id)).size,1);
 await changeAttendance({action:'OUT',id:planned.id},own);
 await assert.rejects(changeAttendance({action:'CORRECT',id:planned.id,start:new Date('2020-01-01T08:00Z'),end:new Date('2020-01-01T16:00Z'),reason:'Correction'},own));
 await changeAttendance({action:'CORRECT',id:planned.id,start:new Date('2020-01-01T08:00Z'),end:new Date('2020-01-01T16:00Z'),reason:'Corrected synthetic attendance'},actor);
 const audit=await prisma.activityLog.findFirstOrThrow({where:{entityId:planned.id,action:'CORRECT'}});assert(JSON.stringify(audit.metadata).includes('before'));assert(JSON.stringify(audit.metadata).includes('after'));
 console.log('Attendance passed: overlapping schedule denial, own attendance, concurrent check-in idempotency and authorized audited corrections.');
 }finally{await prisma.activityLog.deleteMany({where:{entityId:{in:ids}}});await basePrisma.attendanceShift.deleteMany({where:{id:{in:ids}}});}
}
main().finally(()=>prisma.$disconnect());
