import "server-only";
import {prisma,requestBranch} from "@/lib/prisma";
import {Prisma} from "@/generated/prisma/client";

type Candidate={rule:string;sourceId:string;patientId:string|null;evidence:Prisma.InputJsonValue;impact:Prisma.Decimal|null;severity:"HIGH"|"MEDIUM"|"LOW";};
const money=(value:Prisma.Decimal)=>value.toFixed(2);
/** Deterministic branch scan; no financial write is performed. Only released lab results are chargeable. */
export async function scanRevenueGuardian(actorId:string){
 const branchId=await requestBranch();
 const [labs,appointments,fills,invoices,admissions]=await Promise.all([
  prisma.labOrder.findMany({where:{status:{in:["ORDERED","SAMPLE_PENDING","SAMPLE_COLLECTED","PROCESSING","COMPLETED","VERIFIED","RELEASED"]}},include:{encounter:{include:{appointment:true,admission:true}}}}),
  prisma.appointment.findMany({where:{status:"COMPLETED",type:"CONSULTATION"},include:{dentist:{include:{doctorProfile:true}}}}),
  prisma.dispensing.findMany({include:{invoice:{include:{items:true}},batch:{include:{medication:true}},medicine:{include:{prescription:true}}}}),
  prisma.invoice.findMany({where:{OR:[{discount:{gt:0}},{payments:{some:{amount:{lt:0}}}}]},include:{payments:true}}),
  prisma.admission.findMany({where:{status:"DISCHARGED"},select:{id:true,number:true,patientId:true}}),
 ]);
 const candidates:Candidate[]=[];
 for(const order of labs){
  const exists=await prisma.invoice.findUnique({where:{invoiceNumber:"LAB-"+order.id},select:{id:true}});
  if(!exists)candidates.push({rule:order.status==="RELEASED"?"RELEASED_LAB_UNBILLED":"PENDING_LAB_BILL",sourceId:order.id,patientId:order.encounter.appointment?.patientId??order.encounter.admission?.patientId??null,evidence:{status:order.status,testId:order.testId,expectedSource:"LAB-"+order.id,price:money(order.price),explanation:order.status==="RELEASED"?"Released result has no posted LAB invoice":"Order is not released; billing is not yet expected"},impact:order.status==="RELEASED"?order.price:null,severity:order.status==="RELEASED"?"HIGH":"LOW"});
 }
 for(const appt of appointments){
  const fee=appt.dentist.doctorProfile?.consultationFee;
  if(!fee||fee.lte(0))continue;
  const exists=await prisma.invoice.findUnique({where:{invoiceNumber:"OPD-"+appt.id},select:{id:true}});
  if(!exists)candidates.push({rule:"COMPLETED_CONSULTATION_UNBILLED",sourceId:appt.id,patientId:appt.patientId,evidence:{expectedSource:"OPD-"+appt.id,configuredFee:money(fee)},impact:fee,severity:"HIGH"});
 }
 for(const fill of fills){
  const expected=fill.batch.price.mul(fill.quantity);
  const billed=fill.invoice.items.reduce((sum,item)=>sum.plus(item.amount),new Prisma.Decimal(0));
  if(!billed.eq(expected))candidates.push({rule:"DISPENSE_BILL_MISMATCH",sourceId:fill.id,patientId:fill.medicine.prescription.patientId,evidence:{quantity:fill.quantity,unitPrice:money(fill.batch.price),expected:money(expected),invoiceId:fill.invoiceId,billed:money(billed)},impact:expected.minus(billed).gt(0)?expected.minus(billed):null,severity:"HIGH"});
 }
 for(const invoice of invoices){
  if(invoice.discount.gt(0)){
   const auth=invoice.authorization as {discountPermission?:boolean}|null;
   if(!auth?.discountPermission)candidates.push({rule:"DISCOUNT_REVIEW",sourceId:invoice.id,patientId:invoice.patientId,evidence:{invoiceNumber:invoice.invoiceNumber,discount:money(invoice.discount),authorizationRecorded:!!invoice.authorization},impact:invoice.discount,severity:"MEDIUM"});
  }
  for(const refund of invoice.payments.filter(p=>p.amount.lt(0))){
   candidates.push({rule:"REFUND_REVIEW",sourceId:refund.id,patientId:invoice.patientId,evidence:{invoiceId:invoice.id,refundAmount:money(refund.amount.abs()),reasonRecorded:!!refund.reference},impact:refund.amount.abs(),severity:"MEDIUM"});
  }
 }
 for(const admission of admissions){
  const exists=await prisma.invoice.findUnique({where:{invoiceNumber:"IPD-"+admission.number},select:{id:true}});
  if(!exists)candidates.push({rule:"DISCHARGED_UNBILLED",sourceId:admission.id,patientId:admission.patientId,evidence:{admissionNumber:admission.number,expectedSource:"IPD-"+admission.number},impact:null,severity:"HIGH"});
 }
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${branchId+':guardian'},0))::text`;
  const active=new Set(candidates.map(c=>c.rule+':'+c.sourceId));
  const existing=await tx.revenueAlert.findMany({where:{status:{in:["OPEN","REVIEWED"]}}});
  for(const alert of existing)if(!active.has(alert.rule+':'+alert.sourceId))await tx.revenueAlert.update({where:{id:alert.id},data:{status:"RESOLVED",resolvedAt:new Date()}});
  let created=0;
  for(const item of candidates){
   const old=await tx.revenueAlert.findUnique({where:{branchId_rule_sourceId:{branchId,rule:item.rule,sourceId:item.sourceId}}});
   if(!old){await tx.revenueAlert.create({data:{...item,branchId}});created++;}
   else if(old.status==="RESOLVED")await tx.revenueAlert.update({where:{id:old.id},data:{status:"OPEN",resolvedAt:null,evidence:item.evidence,impact:item.impact}});
  }
  await tx.activityLog.create({data:{userId:actorId,action:"SCAN",entityType:"RevenueGuardian",metadata:{candidates:candidates.length,created,resolved:existing.filter(a=>!active.has(a.rule+':'+a.sourceId)).length}}});
  return {candidates:candidates.length,created};
 });
}
