import "server-only";
import {createHash} from "node:crypto";
import {prisma, requestBranch} from "@/lib/prisma";
import {Prisma} from "@/generated/prisma/client";
import {can, type SessionUser} from "@/lib/permissions";
import {invoiceSchema, type InvoiceInput} from "@/lib/validations/invoice";
import {z} from "zod";

export async function createManualInvoice(input: InvoiceInput, requestId: string, actor: SessionUser) {
  if(!can(actor,"billing.create")) throw new Error("Invoice creation permission required.");
  const data=invoiceSchema.parse(input);z.uuid().parse(requestId);
  if(data.discount && (!can(actor,"billing.discount") || !["ADMIN","SUPER_ADMIN"].includes(actor.role.name))) throw new Error("Administrator approval is required for discounts until hospital policy is approved.");
  const branchId=await requestBranch();
  const hash=createHash("sha256").update(JSON.stringify(data)).digest("hex");
  return prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${branchId+':invoice:'+requestId},0))::text`;
    const prior=await tx.invoice.findUnique({where:{branchId_requestId:{branchId,requestId}}});
    if(prior){if(prior.requestHash!==hash)throw new Error("Submission already used with different invoice details.");return prior;}
    await tx.patient.findUniqueOrThrow({where:{id:data.patientId,archivedAt:null}});
    const ids=data.items.flatMap(i=>i.treatmentId?[i.treatmentId]:[]);
    if(new Set(ids).size!==ids.length)throw new Error("A treatment can only appear once on an invoice.");
    for(const id of [...ids].sort()){
      await tx.$queryRaw`SELECT id FROM "Treatment" WHERE id=${id} FOR UPDATE`;
      await tx.treatment.findFirstOrThrow({where:{id,patientId:data.patientId,status:{not:"CANCELLED"}}});
      if(await tx.invoiceItem.findFirst({where:{treatmentId:id,invoice:{voidedAt:null}}}))throw new Error("This treatment has already been billed.");
    }
    const items=data.items.map(i=>({...i,unitPrice:new Prisma.Decimal(i.unitPrice),amount:new Prisma.Decimal(i.unitPrice).mul(i.quantity)}));
    const subtotal=items.reduce((sum,i)=>sum.plus(i.amount),new Prisma.Decimal(0));
    const discount=new Prisma.Decimal(data.discount);const tax=new Prisma.Decimal(data.tax);
    if(discount.gt(subtotal))throw new Error("Discount exceeds the subtotal.");
    const total=subtotal.minus(discount).plus(tax);
    if(total.gt('99999999.99')||subtotal.gt('99999999.99'))throw new Error("Invoice exceeds the supported amount.");
    const [{value}]=await tx.$queryRaw<{value:bigint}[]>`SELECT nextval('hospital_invoice_number') AS value`;
    const authorization={actorId:actor.id,discountPermission:can(actor,"billing.discount"),discount:discount.toFixed(2),recordedAt:new Date().toISOString()};
    const invoice=await tx.invoice.create({data:{requestId,requestHash:hash,authorization,invoiceNumber:`HINV-${String(value).padStart(7,'0')}`,patientId:data.patientId,dentistId:data.dentistId||null,subtotal,discount,tax,total,status:total.isZero()?'PAID':'UNPAID',notes:data.notes||null,createdById:actor.id,items:{create:items}}});
    await tx.activityLog.create({data:{userId:actor.id,action:"CREATE",entityType:"Invoice",entityId:invoice.id,metadata:{after:{subtotal:subtotal.toFixed(2),discount:discount.toFixed(2),tax:tax.toFixed(2),total:total.toFixed(2)},authorization}}});
    return invoice;
  });
}
