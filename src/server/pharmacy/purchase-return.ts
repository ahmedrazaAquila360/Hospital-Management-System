import 'server-only';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {can,type SessionUser} from '@/lib/permissions';
import {stockContext} from './stock-context';
export async function returnPurchase(input:{batchId:string;quantity:number;expected:number;reason:string},actor:SessionUser){
 if(!can(actor,'pharmacy.manage')||!can(actor,'pharmacy.view'))throw new Error('Stock management permission required.');
 const data=z.object({batchId:z.string().min(1),quantity:z.number().int().positive().max(1000000),expected:z.number().int().nonnegative(),reason:z.string().trim().min(3).max(1000)}).parse(input);
 return prisma.$transaction(async tx=>{
 await stockContext(tx,actor.id,'PURCHASE_RETURN',data.batchId,data.reason);
 await tx.$queryRaw`SELECT id FROM "PharmacyBatch" WHERE id=${data.batchId} FOR UPDATE`;
 const before=await tx.pharmacyBatch.findUniqueOrThrow({where:{id:data.batchId}});
 if(before.quantity!==data.expected)throw new Error('Stock changed. Refresh before returning a purchase.');
 if(before.quantity<data.quantity)throw new Error('Return exceeds available stock.');
 const result=await tx.pharmacyBatch.update({where:{id:before.id,quantity:data.expected},data:{quantity:{decrement:data.quantity}}});
 await tx.activityLog.create({data:{userId:actor.id,action:'PURCHASE_RETURN',entityType:'PharmacyBatch',entityId:before.id,description:data.reason,metadata:{quantity:data.quantity,supplier:before.supplier,purchaseValue:before.purchase.mul(data.quantity).toFixed(2),before:before.quantity,after:result.quantity}}});return result;
 });
}
