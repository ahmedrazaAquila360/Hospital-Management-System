import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/prisma';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
import {advanceLabOrder} from '../src/server/laboratory-workflow';
import {postInvoicePayment} from '../src/server/billing/payment-transaction';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const tag=randomUUID(),u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}}),d=await prisma.user.findFirstOrThrow({where:{email:'doctor@hospital.example'}});const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};const tech={...actor,id:d.id,role:{name:'LAB_TECH',label:'Lab tech'},permissions:['lab.view','lab.edit'] as SessionUser['permissions']};const p=await prisma.patient.create({data:{patientCode:'lab-flow-'+tag,fullName:'Synthetic laboratory flow',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});const a=await prisma.appointment.create({data:{patientId:p.id,dentistId:d.id,date:new Date('2020-01-01'),startTime:new Date('2020-01-01T04:00Z'),endTime:new Date('2020-01-01T04:30Z'),status:'CHECKED_IN'}});const e=await prisma.encounter.create({data:{appointmentId:a.id}});const test=await prisma.labTest.create({data:{name:'Synthetic '+tag,category:'Synthetic',price:25}});const order=await prisma.labOrder.create({data:{testId:test.id,encounterId:e.id,price:25}});const form=(status:string)=>{const f=new FormData();f.set('id',order.id);f.set('status',status);f.set('sampleId','synthetic-'+tag);f.set('result','Synthetic result; not for care');return f};
try{
 await assert.rejects(advanceLabOrder(form('SAMPLE_COLLECTED'),{...actor,permissions:[]}));
 for(const status of ['SAMPLE_PENDING','SAMPLE_COLLECTED','PROCESSING','COMPLETED'])await advanceLabOrder(form(status),tech);
 await assert.rejects(advanceLabOrder(form('VERIFIED'),tech));
 await assert.rejects(advanceLabOrder(form('VERIFIED'),{...actor,id:d.id}),/second staff/);
 await advanceLabOrder(form('VERIFIED'),actor);await advanceLabOrder(form('RELEASED'),actor);
 await assert.rejects(advanceLabOrder(form('PROCESSING'),actor));
 const invoice=await prisma.invoice.findUniqueOrThrow({where:{invoiceNumber:'LAB-'+order.id}});assert.equal(invoice.patientId,p.id);assert.equal(invoice.total.toFixed(2),'25.00');assert.equal((await postInvoicePayment({invoiceId:invoice.id,amount:25,method:'CASH',requestId:randomUUID()},actor)).error,undefined);
 assert.equal((await prisma.labOrder.findUniqueOrThrow({where:{id:order.id}})).verifiedBy,u.id);assert.equal(await prisma.invoice.count({where:{invoiceNumber:'LAB-'+order.id}}),1);
 console.log('Laboratory workflow passed: ordered-to-sample-to-draft-to-independent-verification-to-release, access denials, one linked bill and full settlement.');
}finally{const invoices=await prisma.invoice.findMany({where:{patientId:p.id},select:{id:true}});const payments=await prisma.payment.findMany({where:{patientId:p.id},select:{id:true}});await prisma.activityLog.deleteMany({where:{entityId:{in:[order.id,...invoices.map(i=>i.id),...payments.map(i=>i.id)]}}});await prisma.notification.deleteMany({where:{link:{in:['/opd?visit='+e.id,...invoices.map(i=>'/billing/invoices/'+i.id)]}}});await prisma.payment.deleteMany({where:{patientId:p.id}});await prisma.invoice.deleteMany({where:{patientId:p.id}});await prisma.labOrder.delete({where:{id:order.id}});await prisma.labTest.delete({where:{id:test.id}});await prisma.encounter.delete({where:{id:e.id}});await prisma.appointment.delete({where:{id:a.id}});await prisma.patient.delete({where:{id:p.id}})}}
main().finally(()=>prisma.$disconnect());
