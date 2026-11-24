import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {scanRevenueGuardian} from "../src/server/revenue-guardian/scan";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const actor=await prisma.user.findFirstOrThrow({where:{email:"admin@hospital.example"}});
 const patient=await prisma.patient.create({data:{patientCode:`financial-${tag}`,fullName:"Synthetic financial patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const treatment=await prisma.treatment.create({data:{patientId:patient.id,dentistId:actor.id,name:"Synthetic duplicate",cost:20}});
 const a=await prisma.invoice.create({data:{invoiceNumber:`GA-${tag}`,patientId:patient.id,subtotal:20,total:20,items:{create:{description:"Synthetic",quantity:1,unitPrice:20,amount:20,treatmentId:treatment.id}}}});
 const b=await prisma.invoice.create({data:{invoiceNumber:`GB-${tag}`,patientId:patient.id,subtotal:20,discount:5,total:15,items:{create:{description:"Synthetic",quantity:1,unitPrice:20,amount:20,treatmentId:treatment.id}}}});
 try{
  await scanRevenueGuardian(actor.id);
  const duplicate=await prisma.revenueAlert.findUniqueOrThrow({where:{branchId_rule_sourceId:{branchId:"branch-main",rule:"DUPLICATE_TREATMENT_CHARGE",sourceId:treatment.id}}});
  const discount=await prisma.revenueAlert.findUniqueOrThrow({where:{branchId_rule_sourceId:{branchId:"branch-main",rule:"DISCOUNT_REVIEW",sourceId:b.id}}});
  assert.equal(duplicate.impact?.toFixed(2),"20.00");
  assert.equal(discount.impact?.toFixed(2),"5.00");
  await scanRevenueGuardian(actor.id);
  assert.equal(await prisma.revenueAlert.count({where:{rule:"DUPLICATE_TREATMENT_CHARGE",sourceId:treatment.id}}),1);
  console.log("Guardian financial passed: duplicate treatment charge, unauthorized discount, deterministic impact and no duplicate alert.");
 }finally{
  await prisma.revenueAlert.deleteMany({where:{OR:[{rule:"DUPLICATE_TREATMENT_CHARGE",sourceId:treatment.id},{rule:"DISCOUNT_REVIEW",sourceId:b.id}]}});
  await prisma.activityLog.deleteMany({where:{entityType:"RevenueGuardian",userId:actor.id,createdAt:{gte:patient.createdAt}}});
  await prisma.invoice.deleteMany({where:{id:{in:[a.id,b.id]}}});
  await prisma.treatment.delete({where:{id:treatment.id}});
  await prisma.patient.delete({where:{id:patient.id}});
 }
}
main().finally(()=>prisma.$disconnect());
