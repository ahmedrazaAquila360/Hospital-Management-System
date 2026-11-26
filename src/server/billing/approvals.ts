"use server";

import {revalidatePath} from "next/cache";
import {Prisma} from "@/generated/prisma/client";
import {requirePermission} from "@/lib/auth/guard";
import {can} from "@/lib/permissions";
import {prisma} from "@/lib/prisma";
import {z} from "zod";
import {applyFinancialDecision} from "./approval-transaction";

const requestSchema=z.object({invoiceId:z.string().min(1),kind:z.enum(["DISCOUNT","REFUND"]),amount:z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).refine(v=>Number(v)>0),reason:z.string().trim().min(3).max(500),method:z.enum(["CASH","CARD","BANK_TRANSFER","INSURANCE","OTHER"]).optional()});
export async function requestFinancialApproval(form:FormData){
 const actor=await requirePermission("billing.view");
 const data=requestSchema.parse(Object.fromEntries(form));
 if(data.kind==="DISCOUNT"&&!can(actor,"billing.create"))throw new Error("Invoice creation permission is required to request a discount.");
 if(data.kind==="REFUND"&&!can(actor,"billing.payments"))throw new Error("Payment permission is required to request a refund.");
 if(data.kind==="REFUND"&&!data.method)throw new Error("Select the refund method.");
 await prisma.$transaction(async tx=>{
  const invoice=await tx.invoice.findUniqueOrThrow({where:{id:data.invoiceId},include:{payments:true}});
  if(invoice.voidedAt)throw new Error("Voided invoices cannot receive financial requests.");
  const value=new Prisma.Decimal(data.amount);
  const paid=invoice.payments.reduce((sum,p)=>sum.plus(p.amount),new Prisma.Decimal(0));
  if(data.kind==="DISCOUNT"&&(value.gt(invoice.subtotal.minus(invoice.discount))||invoice.total.minus(value).lt(paid)))throw new Error("Discount exceeds the unallocated invoice balance.");
  if(data.kind==="REFUND"&&value.gt(paid))throw new Error("Refund exceeds net payments.");
  const request=await tx.financialApproval.create({data:{invoiceId:invoice.id,kind:data.kind,amount:value,method:data.kind==="REFUND"?data.method:null,reason:data.reason,requestedById:actor.id}});
  await tx.activityLog.create({data:{userId:actor.id,action:"REQUEST",entityType:"FinancialApproval",entityId:request.id,metadata:{kind:data.kind,invoiceId:invoice.id,amount:value.toFixed(2),reason:data.reason}}});
 });revalidatePath("/billing/approvals");
}

export async function decideFinancialApproval(form:FormData){
 const actor=await requirePermission("billing.view");
 const data=z.object({id:z.string().min(1),decision:z.enum(["APPROVE","REJECT"]),reason:z.string().trim().max(500)}).parse(Object.fromEntries(form));
 await applyFinancialDecision(data,actor);
 revalidatePath("/billing/approvals");revalidatePath("/billing/invoices");
}
