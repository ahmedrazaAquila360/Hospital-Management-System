import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma,withBranch} from '../src/lib/prisma';
import {changeReminderConsent,changeFollowUp} from '../src/server/follow-ups/service';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};const p=await prisma.patient.create({data:{patientCode:'follow-access-'+randomUUID(),fullName:'Synthetic follow-up',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});const a=await prisma.appointment.create({data:{patientId:p.id,dentistId:u.id,date:new Date('2020-01-01'),startTime:new Date('2020-01-01T04:00Z'),endTime:new Date('2020-01-01T04:30Z'),status:'COMPLETED'}});const e=await prisma.encounter.create({data:{appointmentId:a.id}});const n=await prisma.clinicalNote.create({data:{encounterId:e.id,authorId:u.id,diagnosis:'Synthetic',narrative:'Synthetic'}});const f=await prisma.followUp.create({data:{patientId:p.id,noteId:n.id,dueDate:new Date('2020-02-01')}});
try{
 for(const role of ['CASHIER','LAB_TECH','PHARMACIST']){const denied={...actor,role:{name:role,label:role},permissions:[]};await assert.rejects(changeReminderConsent(p.id,true,denied));await assert.rejects(changeFollowUp({id:f.id,status:'COMPLETED'},denied));}
 await assert.rejects(changeReminderConsent(p.id,true,{...actor,id:'unassigned',role:{name:'CUSTOM',label:'Custom'},permissions:['patients.edit']}));
 await assert.rejects(withBranch('missing-branch',()=>changeFollowUp({id:f.id,status:'COMPLETED'},actor)));
 await changeReminderConsent(p.id,true,actor);await changeReminderConsent(p.id,false,actor);assert.equal((await prisma.followUp.findUniqueOrThrow({where:{id:f.id}})).status,'OPTED_OUT');await assert.rejects(changeFollowUp({id:f.id,status:'BOOKED'},actor));
 console.log('Follow-up access passed: role and branch denials, custom assignment restriction, consent/opt-out and closed-status protection.');
}finally{await prisma.activityLog.deleteMany({where:{entityId:{in:[p.id,f.id]}}});await prisma.followUp.delete({where:{id:f.id}});await prisma.clinicalNote.delete({where:{id:n.id}});await prisma.encounter.delete({where:{id:e.id}});await prisma.appointment.delete({where:{id:a.id}});await prisma.patient.delete({where:{id:p.id}})}}
main().finally(()=>prisma.$disconnect());
