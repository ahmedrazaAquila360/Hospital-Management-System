import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma,withBranch} from '../src/lib/prisma';
import {basePrisma} from '../src/lib/prisma-base';
import {receiveStock} from '../src/server/pharmacy/receive-transaction';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const tag='receipt-'+randomUUID();const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};
 const data={requestId:randomUUID(),generic:tag,brand:tag,strength:'Synthetic',form:'Tablet',category:'Test',lot:tag,supplier:tag,expiry:'2099-01-01',price:'0.30',purchase:'0.10',quantity:3};
 try{
  await assert.rejects(receiveStock(data,{...actor,permissions:['pharmacy.view']}));
  const retries=await Promise.all(Array.from({length:8},()=>receiveStock(data,actor)));assert.equal(new Set(retries.map(r=>r.id)).size,1);
  const receipt=retries[0];assert.equal(receipt.purchaseTotal.toFixed(2),'0.30');assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({where:{id:receipt.batchId}})).quantity,3);
  assert.equal(await prisma.stockMovement.count({where:{sourceId:receipt.id,kind:'RECEIVE'}}),1);
  await assert.rejects(receiveStock({...data,quantity:4},actor),/different details/);
  await receiveStock({...data,purchase:'0.1',price:'0.3'},actor); // equivalent price formatting is the same request
  const deliveries=await Promise.all(Array.from({length:3},()=>receiveStock({...data,requestId:randomUUID()},actor)));
  assert.equal(new Set(deliveries.map(r=>r.batchId)).size,1);assert.equal(await prisma.pharmacyBatch.count({where:{medication:{generic:tag}}}),1);
  assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({where:{id:receipt.batchId}})).quantity,12);
  await assert.rejects(receiveStock({...data,requestId:randomUUID(),price:'0.50'},actor),/Batch details/);
  const before=await prisma.pharmacyReceipt.count({where:{batchId:receipt.batchId}});
  await assert.rejects(receiveStock({...data,requestId:randomUUID()}, {...actor,id:'missing-test-actor'}));
  assert.equal(await prisma.pharmacyReceipt.count({where:{batchId:receipt.batchId}}),before);
  assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({where:{id:receipt.batchId}})).quantity,12);
  assert.equal(await withBranch('unassigned-branch',()=>prisma.pharmacyReceipt.findUnique({where:{id:receipt.id}})),null);
  await assert.rejects(prisma.pharmacyReceipt.update({where:{id:receipt.id},data:{quantity:99}}));
  const moves=await prisma.stockMovement.findMany({where:{batchId:receipt.batchId}});assert.equal(moves.reduce((n,m)=>n+m.quantity,0),12);
  console.log('Pharmacy receipts passed: concurrent retries post once, distinct deliveries accumulate, decimal totals, changed-payload rejection, atomic rollback, immutable receipt and branch isolation.');
 }finally{
  const batches=await prisma.pharmacyBatch.findMany({where:{medication:{generic:tag}},select:{id:true}});const ids=batches.map(b=>b.id);
  await prisma.activityLog.deleteMany({where:{entityType:'PharmacyBatch',entityId:{in:ids}}});await basePrisma.pharmacyReceipt.deleteMany({where:{batchId:{in:ids}}});await basePrisma.stockMovement.deleteMany({where:{batchId:{in:ids}}});await prisma.pharmacyBatch.deleteMany({where:{id:{in:ids}}});await prisma.medication.deleteMany({where:{generic:tag}});await basePrisma.supplier.deleteMany({where:{name:tag}});
 }
}
main().finally(()=>prisma.$disconnect());
