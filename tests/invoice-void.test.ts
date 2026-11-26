import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/prisma';
import {createManualInvoice} from '../src/server/billing/create-invoice';
import {voidManualInvoice} from '../src/server/billing/void-transaction';
import {listInvoices} from '../src/server/billing/queries';
import {postInvoicePayment} from '../src/server/billing/payment-transaction';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');
 const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};
 const p=await prisma.patient.create({data:{patientCode:'void-'+randomUUID(),fullName:'Synthetic void test',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});
 try{
 const input={patientId:p.id,discount:0,tax:0,items:[{description:'Test charge',quantity:1,unitPrice:10}]};
 const i=await createManualInvoice(input,randomUUID(),actor);
 await assert.rejects(voidManualInvoice(i.id,'Correction',{...actor,role:{name:'CASHIER',label:'Cashier'}}));
 const results=await Promise.allSettled([voidManualInvoice(i.id,'Incorrect service',actor),voidManualInvoice(i.id,'Incorrect service',actor)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const kept=await prisma.invoice.findUniqueOrThrow({where:{id:i.id},include:{items:true}});
 assert(kept.voidedAt);assert.equal(kept.items.length,1);assert.equal(kept.total.toFixed(2),'10.00');
 assert.equal((await listInvoices({status:'VOIDED',patientId:p.id})).total,1);
 assert.equal((await listInvoices({status:'UNPAID',patientId:p.id})).total,0);
 await assert.rejects(prisma.invoice.update({where:{id:i.id},data:{voidedAt:null}}));
 await assert.rejects(prisma.payment.create({data:{invoiceId:i.id,patientId:p.id,receivedById:actor.id,amount:10,method:'CASH',requestId:randomUUID()}}));
 assert.match((await postInvoicePayment({invoiceId:i.id,amount:10,method:'CASH',requestId:randomUUID()},actor)).error??'',/voided/);
 const paid=await createManualInvoice(input,randomUUID(),actor);
 assert.equal((await postInvoicePayment({invoiceId:paid.id,amount:10,method:'CASH',requestId:randomUUID()},actor)).error,undefined);
 await assert.rejects(voidManualInvoice(paid.id,'Correction',actor),/payments/);
 await assert.rejects(prisma.invoice.update({where:{id:paid.id},data:{voidedAt:new Date(),voidedById:actor.id,voidReason:'Direct invalid void'}}));
 assert.equal(await prisma.activityLog.count({where:{entityId:i.id,action:'VOID'}}),1);
 console.log('Invoice void passed: admin access, concurrent void prevention, retained history, blocked payment and paid-invoice protection.');
 }finally{
 const ids=(await prisma.invoice.findMany({where:{patientId:p.id},select:{id:true}})).map(i=>i.id);
 await prisma.activityLog.deleteMany({where:{entityId:{in:ids}}});await prisma.notification.deleteMany({where:{link:{in:ids.map(id=>'/billing/invoices/'+id)}}});
 await prisma.payment.deleteMany({where:{patientId:p.id}});await prisma.invoice.deleteMany({where:{patientId:p.id}});await prisma.patient.delete({where:{id:p.id}});
 }
}
main().finally(()=>prisma.$disconnect());
