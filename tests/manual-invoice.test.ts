import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {createManualInvoice} from "../src/server/billing/create-invoice";
import {ALL_PERMISSION_KEYS, type SessionUser} from "../src/lib/permissions";
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const tag='manual-invoice-'+randomUUID();
 const user=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const actor:SessionUser={id:user.id,name:user.name,email:user.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};
 const patient=await prisma.patient.create({data:{patientCode:tag,fullName:'Synthetic manual billing',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});
 const other=await prisma.patient.create({data:{patientCode:tag+'-other',fullName:'Synthetic other',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});
 const treatment=await prisma.treatment.create({data:{patientId:patient.id,dentistId:actor.id,name:'Synthetic service',cost:10}});
 try{
  const input={patientId:patient.id,discount:0,tax:0,items:[{description:'Synthetic',quantity:3,unitPrice:0.1,treatmentId:treatment.id}]};
  const request=randomUUID();const results=await Promise.all(Array.from({length:8},()=>createManualInvoice(input,request,actor)));
  assert.equal(new Set(results.map(r=>r.id)).size,1);assert.equal(results[0].total.toFixed(2),'0.30');assert(results[0].invoiceNumber.startsWith('HINV-'));
  await assert.rejects(createManualInvoice({...input,notes:'changed'},request,actor));
  await assert.rejects(createManualInvoice(input,randomUUID(),actor));
  await assert.rejects(createManualInvoice({...input,patientId:other.id},randomUUID(),actor));
  await assert.rejects(createManualInvoice({...input,discount:0.01,items:[{description:'test',quantity:1,unitPrice:1}]},randomUUID(),{...actor,permissions:actor.permissions.filter(p=>p!=='billing.discount')}));
  const zero=await createManualInvoice({patientId:patient.id,discount:1,tax:0,items:[{description:'Waived',quantity:1,unitPrice:1}]},randomUUID(),actor);assert.equal(zero.status,'PAID');
  const before=await prisma.invoice.count({where:{patientId:patient.id}});
  await assert.rejects(createManualInvoice({patientId:patient.id,discount:0,tax:0,items:[{description:'Rollback',quantity:1,unitPrice:1}]},randomUUID(),{...actor,id:'missing-actor'}));
  assert.equal(await prisma.invoice.count({where:{patientId:patient.id}}),before);
  console.log('Manual billing passed: retry idempotency, Decimal totals, duplicate/cross-patient rejection, discount authorization, zero balance and rollback.');
 }finally{
  const invoices=await prisma.invoice.findMany({where:{patientId:{in:[patient.id,other.id]}},select:{id:true}});
  await prisma.activityLog.deleteMany({where:{entityType:'Invoice',entityId:{in:invoices.map(i=>i.id)}}});
  await prisma.invoice.deleteMany({where:{patientId:{in:[patient.id,other.id]}}});await prisma.treatment.delete({where:{id:treatment.id}});await prisma.patient.deleteMany({where:{id:{in:[patient.id,other.id]}}});
 }
}
main().finally(()=>prisma.$disconnect());
