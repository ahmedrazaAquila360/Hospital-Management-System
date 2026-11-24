"use server";

import {createHash} from "node:crypto";
import {revalidatePath} from "next/cache";
import {redirect} from "next/navigation";
import {Prisma} from "@/generated/prisma/client";
import {requirePermission} from "@/lib/auth/guard";
import {prisma,requestBranch} from "@/lib/prisma";
import {z} from "zod";

export async function recordServiceCharge(form:FormData){
 const actor=await requirePermission("billing.create");
 const data=z.object({patientId:z.string().min(1),serviceId:z.string().min(1),quantity:z.coerce.number().int().min(1).max(100)}).parse(Object.fromEntries(form));
 await prisma.$transaction(async tx=>{
  await tx.patient.findFirstOrThrow({where:{id:data.patientId,archivedAt:null},select:{id:true}});
  const service=await tx.service.findFirstOrThrow({where:{id:data.serviceId,active:true}});
  const amount=service.price.mul(data.quantity);
  if(amount.gt("99999999.99"))throw new Error("Service charge exceeds supported amount.");
  const charge=await tx.serviceCharge.create({data:{patientId:data.patientId,serviceId:service.id,quantity:data.quantity,unitPrice:service.price,amount,createdById:actor.id}});
  await tx.activityLog.create({data:{userId:actor.id,action:"RECORD",entityType:"ServiceCharge",entityId:charge.id,metadata:{patientId:data.patientId,serviceId:service.id,quantity:data.quantity,unitPrice:service.price.toFixed(2)}}});
 });revalidatePath("/billing/service-charges");
}

export async function postConsolidatedCharges(form:FormData){
 const actor=await requirePermission("billing.create");
 const patientId=z.string().min(1).parse(form.get("patientId"));
 const requestId=z.uuid().parse(form.get("requestId"));
 const branchId=await requestBranch();
 const invoice=await prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${branchId+':consolidate:'+patientId},0))::text`;
  const prior=await tx.invoice.findUnique({where:{branchId_requestId:{branchId,requestId}}});
  if(prior){if(prior.patientId!==patientId)throw new Error("Submission was already used for another patient.");return prior;}
  const charges=await tx.serviceCharge.findMany({where:{patientId,status:"PENDING"},include:{service:{select:{name:true}}},orderBy:{id:"asc"}});
  if(!charges.length)throw new Error("No pending service charges for this patient.");
  for(const charge of charges)await tx.$queryRaw`SELECT id FROM "ServiceCharge" WHERE id=${charge.id} FOR UPDATE`;
  if(await tx.serviceCharge.count({where:{id:{in:charges.map(c=>c.id)},status:"PENDING"}})!==charges.length)throw new Error("Charges changed while posting. Reload.");
  const subtotal=charges.reduce((sum,c)=>sum.plus(c.amount),new Prisma.Decimal(0));
  if(subtotal.gt("99999999.99"))throw new Error("Invoice exceeds supported amount.");
  const [{value}]=await tx.$queryRaw<{value:bigint}[]>`SELECT nextval('hospital_invoice_number') AS value`;
  const hash=createHash("sha256").update(charges.map(c=>c.id).join(",")).digest("hex");
  const created=await tx.invoice.create({data:{requestId,requestHash:hash,invoiceNumber:`HINV-${String(value).padStart(7,"0")}`,patientId,subtotal,total:subtotal,status:subtotal.isZero()?"PAID":"UNPAID",createdById:actor.id}});
  for(const charge of charges){
   const item=await tx.invoiceItem.create({data:{invoiceId:created.id,description:charge.service.name,quantity:charge.quantity,unitPrice:charge.unitPrice,amount:charge.amount}});
   await tx.serviceCharge.update({where:{id:charge.id,status:"PENDING"},data:{status:"POSTED",invoiceItemId:item.id,postedAt:new Date()}});
  }
  await tx.activityLog.create({data:{userId:actor.id,action:"CONSOLIDATE",entityType:"Invoice",entityId:created.id,metadata:{chargeIds:charges.map(c=>c.id),total:subtotal.toFixed(2)}}});
  return created;
 });
 revalidatePath("/billing/service-charges");revalidatePath("/billing/invoices");redirect(`/billing/invoices/${invoice.id}`);
}

export async function voidPendingServiceCharge(form:FormData){
 const actor=await requirePermission("billing.create");
 if(!["ADMIN","SUPER_ADMIN"].includes(actor.role.name))throw new Error("Administrator approval is required to void a charge.");
 const data=z.object({id:z.string().min(1),reason:z.string().trim().min(3).max(500)}).parse(Object.fromEntries(form));
 await prisma.$transaction(async tx=>{
  const charge=await tx.serviceCharge.update({where:{id:data.id,status:"PENDING"},data:{status:"VOIDED",voidedAt:new Date(),voidReason:data.reason}});
  await tx.activityLog.create({data:{userId:actor.id,action:"VOID",entityType:"ServiceCharge",entityId:charge.id,metadata:{reason:data.reason,amount:charge.amount.toFixed(2)}}});
 });revalidatePath("/billing/service-charges");
}
