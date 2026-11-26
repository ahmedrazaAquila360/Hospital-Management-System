import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma,withBranch} from '../src/lib/prisma';
import {basePrisma} from '../src/lib/prisma-base';
import {recordVitals,reviewVitals} from '../src/server/vitals/service';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};
 const p=await prisma.patient.create({data:{patientCode:'vitals-'+randomUUID(),fullName:'Synthetic observations',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});
 const a=await prisma.appointment.create({data:{patientId:p.id,dentistId:u.id,date:new Date('2026-01-01'),startTime:new Date('2026-01-01T04:00Z'),endTime:new Date('2026-01-01T04:30Z'),status:'CHECKED_IN'}});
 const e=await prisma.encounter.create({data:{appointmentId:a.id}});
 try{
 const input={encounterId:e.id,observedAt:new Date(),values:{systolic:120,diastolic:80,saturation:98}};
 const nurse={...actor,role:{name:'NURSE',label:'Nurse'},permissions:['vitals.view','vitals.create'] as SessionUser['permissions']};
 const first=await recordVitals(input,nurse);
 await assert.rejects(reviewVitals(first.id,'Reviewed',nurse));
 await assert.rejects(recordVitals({...input,values:{saturation:101}},actor));
 await assert.rejects(recordVitals({...input,values:{}},actor));
 await assert.rejects(recordVitals(input,{...actor,id:'unassigned-synthetic-user',role:{name:'CUSTOM',label:'Custom'},permissions:['vitals.view','vitals.create']}));
 await assert.rejects(withBranch('missing-branch',()=>recordVitals(input,actor)));
 await reviewVitals(first.id,'Measurements reviewed',actor);
 const changes=await Promise.allSettled([1,2].map(()=>recordVitals({...input,values:{systolic:121},correctionOfId:first.id,reason:'Corrected reading'},actor)));
 assert.equal(changes.filter(r=>r.status==='fulfilled').length,1);
 assert.equal((await prisma.vitalObservation.findUniqueOrThrow({where:{id:first.id}})).values instanceof Object,true);
 await assert.rejects(prisma.vitalObservation.update({where:{id:first.id},data:{values:{pulse:1}}}));
 assert.equal(await prisma.vitalReview.count({where:{observationId:first.id}}),1);
 console.log('Vitals passed: nurse entry, review authorization, invalid values, custom-role and branch denial, append-only history and concurrent corrections.');
 }finally{
 const ids=(await prisma.vitalObservation.findMany({where:{encounterId:e.id},select:{id:true}})).map(v=>v.id);
 await prisma.activityLog.deleteMany({where:{entityId:{in:ids}}});await basePrisma.vitalReview.deleteMany({where:{observationId:{in:ids}}});
 await basePrisma.vitalObservation.deleteMany({where:{encounterId:e.id,correctionOfId:{not:null}}});await basePrisma.vitalObservation.deleteMany({where:{encounterId:e.id}});
 await prisma.encounter.delete({where:{id:e.id}});await prisma.appointment.delete({where:{id:a.id}});await prisma.patient.delete({where:{id:p.id}});
 }
}
main().finally(()=>prisma.$disconnect());
