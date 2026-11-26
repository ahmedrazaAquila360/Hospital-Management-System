import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/prisma';
import {basePrisma} from '../src/lib/prisma-base';
import {stockContext} from '../src/server/pharmacy/stock-context';
import {returnPurchase} from '../src/server/pharmacy/purchase-return';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};const tag=randomUUID();const medication=await prisma.medication.create({data:{generic:tag,brand:tag,strength:'1',form:'Tablet',category:'Synthetic'}});let batchId='';
try{
 const batch=await prisma.$transaction(async tx=>{await stockContext(tx,actor.id,'RECEIVE',tag,'Synthetic receipt');return tx.pharmacyBatch.create({data:{medicationId:medication.id,lot:tag,expiry:new Date('2099-01-01'),supplier:'Synthetic supplier',purchase:2,price:3,quantity:10}})});batchId=batch.id;
 await assert.rejects(returnPurchase({batchId,quantity:1,expected:10,reason:'Return sample'},{...actor,permissions:['pharmacy.view']}));
 const results=await Promise.allSettled([1,2].map(()=>returnPurchase({batchId,quantity:3,expected:10,reason:'Synthetic supplier return'},actor)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 const movements=await prisma.stockMovement.findMany({where:{batchId},orderBy:{createdAt:'asc'}});assert.equal(movements.length,2);assert.equal(movements[0].kind,'RECEIVE');assert.equal(movements[1].kind,'PURCHASE_RETURN');assert.equal(movements[1].actorId,actor.id);assert.equal(movements.reduce((n,m)=>n+m.quantity,0),7);
 await assert.rejects(prisma.pharmacyBatch.update({where:{id:batchId},data:{quantity:-1}}));await assert.rejects(prisma.stockMovement.update({where:{id:movements[0].id},data:{quantity:99}}));
 console.log('Stock ledger passed: receipt, actor evidence, supplier return race protection, reconciled quantity, negative stock rejection and immutable movements.');
}finally{if(batchId){await prisma.activityLog.deleteMany({where:{entityId:batchId}});await basePrisma.stockMovement.deleteMany({where:{batchId}});await prisma.pharmacyBatch.delete({where:{id:batchId}})}await prisma.medication.delete({where:{id:medication.id}})}}
main().finally(()=>prisma.$disconnect());
