import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {postInvoicePayment} from "../src/server/billing/payment-transaction";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const role=await prisma.role.findFirstOrThrow({where:{name:"CASHIER"}});
 const user=await prisma.user.create({data:{name:"Synthetic cashier",email:`cashier-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:role.id}});
 const patient=await prisma.patient.create({data:{patientCode:`shift-${tag}`,fullName:"Synthetic shift patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const invoice=await prisma.invoice.create({data:{invoiceNumber:`SHIFT-${tag}`,patientId:patient.id,subtotal:100,total:100,items:{create:{description:"Synthetic",quantity:1,unitPrice:100,amount:100}}}});
 try{
  await assert.rejects(()=>postInvoicePayment({invoiceId:invoice.id,amount:25,method:"CASH",reference:"",requestId:randomUUID()},{id:user.id,name:user.name,role:{name:"CASHIER"}}),/Open a cashier shift/);
  const shift=await prisma.cashierShift.create({data:{cashierId:user.id,openingCash:10}});
  try{
   await assert.rejects(()=>prisma.cashierShift.create({data:{cashierId:user.id,openingCash:10}}));
   const requestId=randomUUID();
   await postInvoicePayment({invoiceId:invoice.id,amount:25,method:"CASH",reference:"",requestId},{id:user.id,name:user.name,role:{name:"CASHIER"}});
   await postInvoicePayment({invoiceId:invoice.id,amount:25,method:"CASH",reference:"",requestId},{id:user.id,name:user.name,role:{name:"CASHIER"}});
   const payments=await prisma.payment.findMany({where:{invoiceId:invoice.id}});
   assert.equal(payments.length,1);
   assert.equal(payments[0].cashierShiftId,shift.id);
   assert.equal(shift.openingCash.plus(payments[0].amount).toFixed(2),"35.00");
   console.log("Cashier passed: open shift required, unique open shift, payment linked, idempotent posting, expected cash.");
  }finally{await prisma.payment.deleteMany({where:{invoiceId:invoice.id}});await prisma.cashierShift.delete({where:{id:shift.id}});}
 }finally{
  await prisma.notification.deleteMany({where:{userId:user.id}});
  await prisma.activityLog.deleteMany({where:{userId:user.id}});
  await prisma.invoice.delete({where:{id:invoice.id}});
  await prisma.patient.delete({where:{id:patient.id}});
  await prisma.user.delete({where:{id:user.id}});
 }
}
main().finally(()=>prisma.$disconnect());
