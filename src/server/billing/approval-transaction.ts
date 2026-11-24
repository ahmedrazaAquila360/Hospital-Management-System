import "server-only";
import {Prisma} from "@/generated/prisma/client";
import {can,type SessionUser} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {applyInvoiceRefund} from "./refund-transaction";

export async function applyFinancialDecision(data:{id:string;decision:"APPROVE"|"REJECT";reason:string},actor:SessionUser){
 if(!["ADMIN","SUPER_ADMIN"].includes(actor.role.name))throw new Error("Administrator approval is required until hospital policy is approved.");
 if(data.decision==="REJECT"&&!data.reason)throw new Error("Record a rejection reason.");
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "FinancialApproval" WHERE id=${data.id} FOR UPDATE`;
  const request=await tx.financialApproval.findFirstOrThrow({where:{id:data.id,status:"REQUESTED"}});
  if(request.requestedById===actor.id)throw new Error("A different administrator must decide this request.");
  if(!can(actor,request.kind==="REFUND"?"billing.refund":"billing.discount"))throw new Error("Approval permission is required.");
  if(data.decision==="REJECT"){
   await tx.financialApproval.update({where:{id:request.id,status:"REQUESTED"},data:{status:"REJECTED",decidedById:actor.id,decidedAt:new Date(),decisionReason:data.reason}});
  }else if(request.kind==="REFUND"){
   if(!request.method)throw new Error("The refund method is missing.");
   const result=await applyInvoiceRefund(tx,{invoiceId:request.invoiceId,requestId:request.id,amount:request.amount.toFixed(2),reason:request.reason,method:request.method},actor.id);
   if(result.error)throw new Error(result.error);
   await tx.financialApproval.update({where:{id:request.id,status:"REQUESTED"},data:{status:"APPLIED",decidedById:actor.id,decidedAt:new Date(),decisionReason:data.reason,appliedPaymentId:result.paymentId}});
  }else{
   await tx.$queryRaw`SELECT id FROM "Invoice" WHERE id=${request.invoiceId} FOR UPDATE`;
   const invoice=await tx.invoice.findUniqueOrThrow({where:{id:request.invoiceId},include:{payments:true}});
   const paid=invoice.payments.reduce((sum,p)=>sum.plus(p.amount),new Prisma.Decimal(0));
   const total=invoice.total.minus(request.amount);
   if(request.amount.gt(invoice.subtotal.minus(invoice.discount))||total.lt(paid))throw new Error("Invoice balance changed. This discount can no longer be applied.");
   const newDiscount=invoice.discount.plus(request.amount);
   await tx.invoice.update({where:{id:invoice.id},data:{discount:newDiscount,total,status:paid.gte(total)?"PAID":paid.gt(0)?"PARTIALLY_PAID":"UNPAID"}});
   await tx.activityLog.create({data:{userId:actor.id,action:"DISCOUNT",entityType:"Invoice",entityId:invoice.id,metadata:{before:{discount:invoice.discount.toFixed(2),total:invoice.total.toFixed(2)},after:{discount:newDiscount.toFixed(2),total:total.toFixed(2)},requestId:request.id}}});
   await tx.financialApproval.update({where:{id:request.id,status:"REQUESTED"},data:{status:"APPLIED",decidedById:actor.id,decidedAt:new Date(),decisionReason:data.reason}});
  }
  await tx.activityLog.create({data:{userId:actor.id,action:data.decision,entityType:"FinancialApproval",entityId:request.id,metadata:{kind:request.kind,amount:request.amount.toFixed(2),reason:data.reason}}});
  return request.invoiceId;
 });
}
