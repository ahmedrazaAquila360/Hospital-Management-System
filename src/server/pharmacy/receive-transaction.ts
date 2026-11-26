import 'server-only';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {Prisma} from '@/generated/prisma/client';
import {prisma,requestBranch} from '@/lib/prisma';
import {can,type SessionUser} from '@/lib/permissions';
import {stockContext} from './stock-context';
const field=z.string().trim().min(1).max(150);
const price=z.string().regex(/^\d{1,8}(\.\d{1,2})?$/).transform(value=>new Prisma.Decimal(value).toFixed(2));
export const stockReceiptSchema=z.object({requestId:z.uuid(),generic:field,brand:field,strength:field,form:field,category:field,lot:field,supplier:field,expiry:z.iso.date(),price,purchase:price,quantity:z.coerce.number().int().positive().max(1000000)});
export async function receiveStock(input:Record<string,unknown>,actor:SessionUser){
 if(!can(actor,'pharmacy.manage')||!can(actor,'pharmacy.view'))throw new Error('Stock receiving permission required.');
 const {requestId,...data}=stockReceiptSchema.parse(input);
 const purchaseTotal=new Prisma.Decimal(data.purchase).mul(data.quantity);
 if(purchaseTotal.gt('9999999999.99'))throw new Error('Receipt exceeds the supported purchase amount.');
 const branchId=await requestBranch();const hash=createHash('sha256').update(JSON.stringify(data)).digest('hex');
 const identity={generic:data.generic,brand:data.brand,strength:data.strength,form:data.form};
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${branchId+':receipt:'+requestId},0))::text`;
  const prior=await tx.pharmacyReceipt.findUnique({where:{branchId_requestId:{branchId,requestId}}});
  if(prior){if(prior.requestHash!==hash)throw new Error('Receipt submission already used with different details. Refresh for a new delivery.');return prior;}
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify([branchId,'batch',identity,data.lot])},0))::text`;
  const medication=await tx.medication.upsert({where:{generic_brand_strength_form:identity},create:{...identity,category:data.category},update:{}});
  const existing=await tx.pharmacyBatch.findUnique({where:{branchId_medicationId_lot:{branchId,medicationId:medication.id,lot:data.lot}}});
  if(existing&&(existing.expiry.toISOString().slice(0,10)!==data.expiry||!existing.price.equals(data.price)||!existing.purchase.equals(data.purchase)||existing.supplier!==data.supplier))throw new Error('Batch details differ from the existing lot.');
  const supplier=await tx.supplier.upsert({where:{branchId_name:{branchId,name:data.supplier}},create:{name:data.supplier},update:{}});
  if(!supplier.active)throw new Error('Supplier is inactive.');
  const receiptId=randomUUID();
  await stockContext(tx,actor.id,'RECEIVE',receiptId,data.supplier);
  const batch=existing?await tx.pharmacyBatch.update({where:{id:existing.id},data:{quantity:{increment:data.quantity}}}):await tx.pharmacyBatch.create({data:{medicationId:medication.id,lot:data.lot,supplier:data.supplier,expiry:new Date(data.expiry),purchase:data.purchase,price:data.price,quantity:data.quantity}});
  const receipt=await tx.pharmacyReceipt.create({data:{id:receiptId,requestId,requestHash:hash,batchId:batch.id,supplierName:data.supplier,quantity:data.quantity,purchaseTotal,createdById:actor.id}});
  await tx.activityLog.create({data:{userId:actor.id,action:'RECEIVE',entityType:'PharmacyBatch',entityId:batch.id,metadata:{receiptId:receipt.id,requestId,quantity:data.quantity,purchaseTotal:receipt.purchaseTotal.toFixed(2)}}});
  return receipt;
 });
}
