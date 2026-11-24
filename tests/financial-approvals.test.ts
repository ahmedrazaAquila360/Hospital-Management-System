import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {ALL_PERMISSION_KEYS,type SessionUser} from "../src/lib/permissions";
import {applyFinancialDecision} from "../src/server/billing/approval-transaction";
import {scanRevenueGuardian} from "../src/server/revenue-guardian/scan";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const admin=await prisma.user.findFirstOrThrow({where:{email:"admin@hospital.example"}});
 const role=await prisma.role.findFirstOrThrow({where:{name:"CASHIER"}});
 const requester=await prisma.user.create({data:{name:"Synthetic requestor",email:`requestor-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:role.id}});
 const actor:SessionUser={id:admin.id,name:admin.name,email:admin.email,phone:null,avatarUrl:null,role:{name:"ADMIN",label:"Admin"},permissions:[...ALL_PERMISSION_KEYS]};
 const patient=await prisma.patient.create({data:{patientCode:`approval-${tag}`,fullName:"Synthetic approval patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const invoice=await prisma.invoice.create({data:{invoiceNumber:`APPROVAL-${tag}`,patientId:patient.id,subtotal:100,total:100,status:"PARTIALLY_PAID",items:{create:{description:"Synthetic",quantity:1,unitPrice:100,amount:100}}}});
 const receipt=await prisma.payment.create({data:{invoiceId:invoice.id,patientId:patient.id,amount:50,method:"CASH",requestId:randomUUID(),receivedById:admin.id}});
 try{
  const discount=await prisma.financialApproval.create({data:{invoiceId:invoice.id,kind:"DISCOUNT",amount:10,reason:"Synthetic review",requestedById:requester.id}});
  const attempts=await Promise.allSettled([applyFinancialDecision({id:discount.id,decision:"APPROVE",reason:"Reviewed"},actor),applyFinancialDecision({id:discount.id,decision:"APPROVE",reason:"Reviewed"},actor)]);
  assert.equal(attempts.filter(r=>r.status==="fulfilled").length,1);
  assert.equal((await prisma.invoice.findUniqueOrThrow({where:{id:invoice.id}})).total.toFixed(2),"90.00");
  const refund=await prisma.financialApproval.create({data:{invoiceId:invoice.id,kind:"REFUND",amount:20,method:"CASH",reason:"Synthetic refund",requestedById:requester.id}});
  await applyFinancialDecision({id:refund.id,decision:"APPROVE",reason:"Reviewed"},actor);
  assert.equal(await prisma.payment.count({where:{invoiceId:invoice.id}}),2);
  const appliedRefund=await prisma.financialApproval.findUniqueOrThrow({where:{id:refund.id}});
  assert.equal(appliedRefund.status,"APPLIED");
  await scanRevenueGuardian(admin.id);
  assert.equal(await prisma.revenueAlert.count({where:{sourceId:{in:[invoice.id,appliedRefund.appliedPaymentId??""]},rule:{in:["DISCOUNT_REVIEW","REFUND_REVIEW"]}}}),0);
  const self=await prisma.financialApproval.create({data:{invoiceId:invoice.id,kind:"DISCOUNT",amount:1,reason:"Self review should fail",requestedById:admin.id}});
  await assert.rejects(()=>applyFinancialDecision({id:self.id,decision:"APPROVE",reason:""},actor),/different administrator/);
  console.log("Financial approvals passed: two-person review, concurrent single application, discount/refund posting and Guardian reconciliation.");
 }finally{
  await prisma.activityLog.deleteMany({where:{OR:[{entityType:"FinancialApproval",entityId:{in:(await prisma.financialApproval.findMany({where:{invoiceId:invoice.id},select:{id:true}})).map(r=>r.id)}},{entityType:"Invoice",entityId:invoice.id},{entityType:"Payment",entityId:{in:(await prisma.payment.findMany({where:{invoiceId:invoice.id},select:{id:true}})).map(r=>r.id)}}]}});
  await prisma.financialApproval.deleteMany({where:{invoiceId:invoice.id}});
  await prisma.payment.deleteMany({where:{invoiceId:invoice.id}});
  await prisma.revenueAlert.deleteMany({where:{sourceId:invoice.id}});
  await prisma.invoice.delete({where:{id:invoice.id}});
  await prisma.patient.delete({where:{id:patient.id}});
  await prisma.user.delete({where:{id:requester.id}});
 }
}
main().finally(()=>prisma.$disconnect());
