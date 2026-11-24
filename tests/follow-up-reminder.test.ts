import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {processDueFollowUpReminders} from "../src/server/follow-ups/reminder-job";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const role=await prisma.role.findFirstOrThrow({where:{name:"DENTIST"}});
 const doctor=await prisma.user.create({data:{name:"Synthetic reminder doctor",email:`reminder-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:role.id}});
 const patient=await prisma.patient.create({data:{patientCode:`reminder-${tag}`,fullName:"Synthetic reminder patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000",reminderConsent:false}});
 const appt=await prisma.appointment.create({data:{patientId:patient.id,dentistId:doctor.id,date:new Date("2020-01-01"),startTime:new Date("2020-01-01T04:00:00Z"),endTime:new Date("2020-01-01T04:30:00Z"),status:"COMPLETED"}});
 const encounter=await prisma.encounter.create({data:{appointmentId:appt.id}});
 const note=await prisma.clinicalNote.create({data:{encounterId:encounter.id,authorId:doctor.id,diagnosis:"Synthetic",narrative:"Synthetic",followUp:new Date("2020-02-01")}});
 const task=await prisma.followUp.create({data:{patientId:patient.id,noteId:note.id,dueDate:new Date("2020-02-01")}});
 try{
  assert.equal(await processDueFollowUpReminders(),0);
  await prisma.patient.update({where:{id:patient.id},data:{reminderConsent:true}});
  assert.equal(await processDueFollowUpReminders(),1);
  assert.equal(await processDueFollowUpReminders(),0);
  const messages=await prisma.notification.findMany({where:{userId:doctor.id,title:"Follow-up due"}});
  assert.equal(messages.length,1);
  assert(!messages[0].message.includes(patient.fullName));
  assert((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).reminderSentAt);
  console.log("Follow-up reminders passed: consent, idempotent internal delivery and no patient details in notification.");
 }finally{
  await prisma.notification.deleteMany({where:{userId:doctor.id}});
  await prisma.followUp.delete({where:{id:task.id}});
  await prisma.clinicalNote.delete({where:{id:note.id}});
  await prisma.encounter.delete({where:{id:encounter.id}});
  await prisma.appointment.delete({where:{id:appt.id}});
  await prisma.patient.delete({where:{id:patient.id}});
  await prisma.user.delete({where:{id:doctor.id}});
 }
}
main().finally(()=>prisma.$disconnect());
