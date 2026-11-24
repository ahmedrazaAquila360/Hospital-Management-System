import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {guardianReviewers} from "../src/server/revenue-guardian/reviewers";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const cashierRole=await prisma.role.findFirstOrThrow({where:{name:"CASHIER"}});
 const labRole=await prisma.role.findFirstOrThrow({where:{name:"LAB_TECH"}});
 const permission=await prisma.permission.findFirstOrThrow({where:{key:"billing.guardian"}});
 const cashier=await prisma.user.create({data:{name:"Synthetic reviewer",email:`reviewer-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:cashierRole.id}});
 const lab=await prisma.user.create({data:{name:"Synthetic lab",email:`lab-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:labRole.id}});
 try{
  await prisma.branchMembership.createMany({data:[{userId:cashier.id,branchId:"branch-main"},{userId:lab.id,branchId:"branch-main"}],skipDuplicates:true});
  assert((await guardianReviewers()).some(r=>r.id===cashier.id));
  assert(!(await guardianReviewers()).some(r=>r.id===lab.id));
  await prisma.userPermission.create({data:{userId:lab.id,permissionId:permission.id,granted:true}});
  assert((await guardianReviewers()).some(r=>r.id===lab.id));
  await prisma.userPermission.create({data:{userId:cashier.id,permissionId:permission.id,granted:false}});
  assert(!(await guardianReviewers()).some(r=>r.id===cashier.id));
  console.log("Guardian roles passed: branch reviewer permission, custom grant and explicit revoke.");
 }finally{
  await prisma.userPermission.deleteMany({where:{userId:{in:[cashier.id,lab.id]}}});
  await prisma.branchMembership.deleteMany({where:{userId:{in:[cashier.id,lab.id]}}});
  await prisma.user.deleteMany({where:{id:{in:[cashier.id,lab.id]}}});
 }
}
main().finally(()=>prisma.$disconnect());
