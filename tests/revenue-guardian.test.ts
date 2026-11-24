import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {scanRevenueGuardian} from "../src/server/revenue-guardian/scan";
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');
 const tag='guardian-'+randomUUID();
 const actor=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const doctor=await prisma.user.findFirstOrThrow({where:{email:'doctor@hospital.example'}});
 const patient=await prisma.patient.create({data:{patientCode:tag,fullName:'Synthetic guardian patient',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});
 const test=await prisma.labTest.create({data:{name:tag,category:'Synthetic',price:25}});
 const appt=await prisma.appointment.create({data:{patientId:patient.id,dentistId:doctor.id,date:new Date('2099-01-01'),startTime:new Date('2099-01-01T04:00:00Z'),endTime:new Date('2099-01-01T04:30:00Z')}});
 const encounter=await prisma.encounter.create({data:{appointmentId:appt.id}});
 const order=await prisma.labOrder.create({data:{encounterId:encounter.id,testId:test.id,price:25,status:'RELEASED'}});
 try{
  await Promise.all(Array.from({length:3},()=>scanRevenueGuardian(actor.id)));
  const alert=await prisma.revenueAlert.findUniqueOrThrow({where:{branchId_rule_sourceId:{branchId:'branch-main',rule:'RELEASED_LAB_UNBILLED',sourceId:order.id}}});
  assert.equal(alert.status,'OPEN');assert.equal(alert.impact?.toFixed(2),'25.00');
  assert.equal(await prisma.revenueAlert.count({where:{rule:'RELEASED_LAB_UNBILLED',sourceId:order.id}}),1);
  const invoice=await prisma.invoice.create({data:{invoiceNumber:'LAB-'+order.id,patientId:patient.id,dentistId:doctor.id,subtotal:25,total:25,items:{create:{description:'Synthetic lab',quantity:1,unitPrice:25,amount:25}}}});
  await scanRevenueGuardian(actor.id);
  assert.equal((await prisma.revenueAlert.findUniqueOrThrow({where:{id:alert.id}})).status,'RESOLVED');
  await prisma.invoice.delete({where:{id:invoice.id}});
  await scanRevenueGuardian(actor.id);
  assert.equal((await prisma.revenueAlert.findUniqueOrThrow({where:{id:alert.id}})).status,'OPEN');
  console.log('Guardian passed: unbilled released lab alert, deterministic impact, concurrent idempotent scans, reconciliation and reopen.');
 }finally{
  await prisma.revenueAlert.deleteMany({where:{sourceId:order.id}});
  await prisma.activityLog.deleteMany({where:{entityType:'RevenueGuardian',userId:actor.id,createdAt:{gte:patient.createdAt}}});
  await prisma.labOrder.delete({where:{id:order.id}});await prisma.encounter.delete({where:{id:encounter.id}});await prisma.appointment.delete({where:{id:appt.id}});await prisma.labTest.delete({where:{id:test.id}});await prisma.patient.delete({where:{id:patient.id}});
 }
}
main().finally(()=>prisma.$disconnect());
