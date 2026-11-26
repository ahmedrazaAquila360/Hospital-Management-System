import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {basePrisma} from '../src/lib/prisma-base';
import {prisma,withBranch} from '../src/lib/prisma';
import {GET} from '../src/app/api/waiting-board/route';
import {boardToken} from '../src/server/waiting-board/token';
import {calendarDay} from '../src/lib/report-calendar';
import {hospitalZone} from '../src/server/reports/calendar';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');process.env.HOSPITAL_WAITING_BOARD_KEY='synthetic-multibranch-display-key-not-for-live';const tag=randomUUID();const hospital=await basePrisma.clinicSettings.findFirstOrThrow();const branch=await basePrisma.branch.create({data:{name:'Synthetic board '+tag,hospitalId:hospital.id}});const fixtures:{branch:string;patient:string;appointment:string;encounter:string;doctor:string}[]=[];
try{
 for(const branchId of ['branch-main',branch.id])await withBranch(branchId,async()=>{
 const role=await prisma.role.findFirstOrThrow({where:{name:'DENTIST'}});const doctor=await prisma.user.create({data:{name:'Synthetic doctor '+tag,email:branchId+'-'+tag+'@example.invalid',passwordHash:'disabled',roleId:role.id}});
 const patient=await prisma.patient.create({data:{patientCode:branchId+'-'+tag,fullName:'Private synthetic '+tag,dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});const day=calendarDay(await hospitalZone());const a=await prisma.appointment.create({data:{patientId:patient.id,dentistId:doctor.id,date:new Date(day),startTime:new Date(day+'T04:00Z'),endTime:new Date(day+'T04:30Z'),status:'CHECKED_IN'}});const e=await prisma.encounter.create({data:{appointmentId:a.id}});fixtures.push({branch:branchId,patient:patient.id,appointment:a.id,encounter:e.id,doctor:doctor.id});
 });
 const tokens=await Promise.all(fixtures.map(f=>withBranch(f.branch,()=>prisma.encounter.findUniqueOrThrow({where:{id:f.encounter}}))));
 for(let i=0;i<fixtures.length;i++){
 const response=await GET(new Request('http://localhost/api/waiting-board?display='+encodeURIComponent(boardToken(fixtures[i].branch))));assert.equal(response.status,200);const body=await response.text();const data=JSON.parse(body);assert(data.queue.some((r:{token:number})=>r.token===tokens[i].token));assert(!data.queue.some((r:{token:number})=>r.token===tokens[1-i].token));for(const f of fixtures)assert(!body.includes(f.patient));assert(!body.includes('Private synthetic'));assert.equal(response.headers.get('Cache-Control'),'no-store');}
 assert.equal((await GET(new Request('http://localhost/api/waiting-board?display=invalid'))).status,403);
 console.log('Waiting board branches passed: signed branch displays isolate live tokens, omit patient identity and reject forged links.');
}finally{for(const f of fixtures)await withBranch(f.branch,async()=>{await prisma.encounter.delete({where:{id:f.encounter}});await prisma.appointment.delete({where:{id:f.appointment}});await prisma.patient.delete({where:{id:f.patient}});await prisma.user.delete({where:{id:f.doctor}})});await basePrisma.branch.delete({where:{id:branch.id}});}}
main().finally(()=>prisma.$disconnect());
