import "server-only";
import {prisma} from "@/lib/prisma";
import {can,type SessionUser} from "@/lib/permissions";

export async function voidManualInvoice(id:string,reason:string,actor:SessionUser){
 if(!can(actor,"billing.void")||!["ADMIN","SUPER_ADMIN"].includes(actor.role.name))throw new Error("Administrator invoice-void permission is required.");
 if(reason.trim().length<3||reason.length>500)throw new Error("Enter a void reason.");
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id=${id} FOR UPDATE`;
  const invoice=await tx.invoice.findUniqueOrThrow({where:{id},include:{payments:true,items:{include:{serviceCharge:true}}}});
  if(invoice.voidedAt)throw new Error("Invoice is already voided.");
  if(!invoice.invoiceNumber.startsWith("HINV-"))throw new Error("Automatically generated clinical and pharmacy invoices cannot be voided here. Use the authorized correction workflow.");
  if(invoice.payments.length)throw new Error("Invoices with payments require a refund and correction; they cannot be voided.");
  if(invoice.items.some(item=>item.serviceCharge))throw new Error("A consolidated service invoice cannot be voided here; preserve its charge linkage.");
  const voidedAt=new Date();
  await tx.invoice.update({where:{id,voidedAt:null},data:{voidedAt,voidedById:actor.id,voidReason:reason.trim()}});
  await tx.activityLog.create({data:{userId:actor.id,action:"VOID",entityType:"Invoice",entityId:id,metadata:{reason:reason.trim(),invoiceNumber:invoice.invoiceNumber,total:invoice.total.toFixed(2),itemIds:invoice.items.map(item=>item.id),voidedAt:voidedAt.toISOString()}}});
  return invoice;
 });
}
