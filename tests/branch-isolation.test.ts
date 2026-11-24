import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {basePrisma as base} from "../src/lib/prisma-base";
import {prisma, withBranch} from "../src/lib/prisma";
async function main() {
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag='branch-test-'+randomUUID();
 const hospital=await base.clinicSettings.findFirstOrThrow();
 const branch=await base.branch.create({data:{name:tag,hospitalId:hospital.id}});
 const branch2=await base.branch.create({data:{name:tag+'-two',hospitalId:hospital.id}});
 const role=await base.role.findUniqueOrThrow({where:{name:'ADMIN'}});
 const records: {patient?:string; user?:string; bed?:string; doc?:string}={};
 try {
 await withBranch(branch.id,async()=>{
  const user=await prisma.user.create({data:{name:tag,email:tag+'@hospital.example',passwordHash:'synthetic',roleId:role.id}});records.user=user.id;
  const patient=await prisma.patient.create({data:{patientCode:tag,fullName:'Synthetic branch patient',dob:new Date('2000-01-01'),gender:'OTHER',phone:'000'}});records.patient=patient.id;
  const bed=await prisma.bed.create({data:{ward:'Test',room:'Test',label:'1',category:'Test'}});records.bed=bed.id;
  const doc=await prisma.document.create({data:{patientId:patient.id,name:'Synthetic',type:'OTHER',fileUrl:'private:'+'a'.repeat(32)+'.pdf',fileSize:10,mimeType:'application/pdf',uploadedById:user.id}});records.doc=doc.id;
  assert.equal(await prisma.document.count({where:{id:doc.id}}),1);
  const raw=await prisma.$queryRaw<{id:string}[]>`SELECT id FROM "Document" WHERE id=${doc.id}`;assert.equal(raw.length,1);
 });
 await withBranch(branch2.id,async()=>{
  assert.equal(await prisma.user.findUnique({where:{id:records.user}}),null);
  assert.equal(await prisma.patient.findUnique({where:{id:records.patient}}),null);
  assert.equal(await prisma.document.findUnique({where:{id:records.doc}}),null);
  assert.equal(await prisma.bed.count({where:{id:records.bed}}),0);
  const raw=await prisma.$queryRaw<{id:string}[]>`SELECT id FROM "Document" WHERE id=${records.doc}`;assert.equal(raw.length,0);
  await assert.rejects(prisma.document.update({where:{id:records.doc},data:{name:'forbidden'}}));
  await assert.rejects(prisma.document.create({data:{patientId:records.patient,name:'forbidden',type:'OTHER',fileUrl:'private:fake',fileSize:10,mimeType:'application/pdf',uploadedById:records.user!}}));
  await assert.rejects(prisma.bed.create({data:{branchId:branch.id,ward:'forbidden',room:'x',label:'x',category:'x'}}));
 });
 // Enroll the same central patient, preserving identity while historical branch documents stay hidden.
 await base.patientBranch.create({data:{patientId:records.patient!,branchId:branch2.id}});
 await withBranch(branch2.id,async()=>{
  const patient=await prisma.patient.findUniqueOrThrow({where:{id:records.patient},include:{documents:true}});
  assert.equal(patient.documents.length,0);assert.equal(patient.patientCode,tag);
  const grouped=await prisma.document.groupBy({by:['type'],where:{patientId:records.patient},_count:true});assert.equal(grouped.length,0);
 });
 // Transaction rollback and array transactions must retain one connection and branch.
 await withBranch(branch.id,async()=>{
  await assert.rejects(prisma.$transaction(async tx=>{await tx.bed.update({where:{id:records.bed},data:{status:'MAINTENANCE'}});throw Error('rollback');}));
  assert.equal((await prisma.bed.findUniqueOrThrow({where:{id:records.bed}})).status,'AVAILABLE');
  const result=await prisma.$transaction([prisma.document.count({where:{id:records.doc}}),prisma.bed.count({where:{id:records.bed}})]);assert.deepEqual(result,[1,1]);
 });
 await Promise.all(Array.from({length:12},(_,i)=>withBranch(i%2?branch.id:branch2.id,async()=>assert.equal(await prisma.document.count({where:{id:records.doc}}),i%2?1:0))));
 console.log('Branch isolation passed: reads, raw SQL, nested relations, writes, foreign links, forged branch, aggregates, shared identity, rollback, batches and concurrent context isolation.');
 } finally {
  if(records.doc)await base.document.deleteMany({where:{id:records.doc}});
  if(records.bed)await base.bed.deleteMany({where:{id:records.bed}});
  if(records.patient)await base.patient.deleteMany({where:{id:records.patient}});
  if(records.user)await base.user.deleteMany({where:{id:records.user}});
  await base.branch.deleteMany({where:{id:{in:[branch.id,branch2.id]}}});
 }
}
main().finally(()=>base.$disconnect());
