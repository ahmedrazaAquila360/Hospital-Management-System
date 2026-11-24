import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {can,effectivePermissions} from "../src/lib/permissions";
import {scanRevenueGuardian} from "../src/server/revenue-guardian/scan";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 assert.equal(can({permissions:effectivePermissions("CUSTOM",[],[])} as never,"billing.guardian"),false);
 const tag=randomUUID();
 const actor=await prisma.user.findFirstOrThrow({where:{email:"admin@hospital.example"}});
 const department=await prisma.department.findFirstOrThrow();
 const patient=await prisma.patient.create({data:{patientCode:`service-${tag}`,fullName:"Synthetic service patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const service=await prisma.service.create({data:{name:`Synthetic ${tag}`,category:"Test",price:40,departmentId:department.id}});
 const charge=await prisma.serviceCharge.create({data:{patientId:patient.id,serviceId:service.id,quantity:2,unitPrice:40,amount:80,createdById:actor.id}});
 let invoiceId:string|undefined;
 try{
  await scanRevenueGuardian(actor.id);
  await scanRevenueGuardian(actor.id);
  const alert=await prisma.revenueAlert.findUniqueOrThrow({where:{branchId_rule_sourceId:{branchId:"branch-main",rule:"SERVICE_CHARGE_UNBILLED",sourceId:charge.id}}});
  assert.equal(alert.status,"OPEN");assert.equal(alert.impact?.toFixed(2),"80.00");
  assert.equal(await prisma.revenueAlert.count({where:{rule:"SERVICE_CHARGE_UNBILLED",sourceId:charge.id}}),1);
  const invoice=await prisma.invoice.create({data:{invoiceNumber:`SERVICE-${tag}`,patientId:patient.id,subtotal:80,total:80,items:{create:{description:service.name,quantity:2,unitPrice:40,amount:80}}},include:{items:true}});
  invoiceId=invoice.id;
  await prisma.serviceCharge.update({where:{id:charge.id},data:{status:"POSTED",invoiceItemId:invoice.items[0].id,postedAt:new Date()}});
  await scanRevenueGuardian(actor.id);
  assert.equal((await prisma.revenueAlert.findUniqueOrThrow({where:{id:alert.id}})).status,"RESOLVED");
  console.log("Service Guardian passed: unbilled service, deterministic impact, idempotent scans, posted-line reconciliation and custom-role denial.");
 }finally{
  await prisma.revenueAlert.deleteMany({where:{sourceId:charge.id}});
  await prisma.activityLog.deleteMany({where:{entityType:"RevenueGuardian",userId:actor.id,createdAt:{gte:patient.createdAt}}});
  await prisma.serviceCharge.delete({where:{id:charge.id}});
  if(invoiceId)await prisma.invoice.delete({where:{id:invoiceId}});
  await prisma.service.delete({where:{id:service.id}});
  await prisma.patient.delete({where:{id:patient.id}});
 }
}
main().finally(()=>prisma.$disconnect());
