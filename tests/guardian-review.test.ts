import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma,withBranch} from '../src/lib/prisma';
import {reviewAlert} from '../src/server/revenue-guardian/review';
import {ALL_PERMISSION_KEYS,type SessionUser} from '../src/lib/permissions';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const u=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});const actor:SessionUser={id:u.id,name:u.name,email:u.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};const alert=await prisma.revenueAlert.create({data:{branchId:'branch-main',rule:'DISCOUNT_REVIEW',sourceId:randomUUID(),evidence:{synthetic:true},severity:'MEDIUM'}});
try{
 for(const role of ['DENTIST','LAB_TECH','PHARMACIST'])await assert.rejects(reviewAlert({id:alert.id,status:'REVIEWED'},{...actor,role:{name:role,label:role},permissions:[]}));
 await assert.rejects(reviewAlert({id:alert.id,status:'DISMISSED'},actor));
 await assert.rejects(reviewAlert({id:alert.id,status:'REVIEWED',assigneeId:'unassigned'},actor));
 await assert.rejects(withBranch('missing-branch',()=>reviewAlert({id:alert.id,status:'REVIEWED'},actor)));
 await reviewAlert({id:alert.id,status:'REVIEWED',assigneeId:u.id,reason:'Checked evidence'},{...actor,role:{name:'CUSTOM',label:'Authorized reviewer'},permissions:['billing.guardian']});
 await reviewAlert({id:alert.id,status:'DISMISSED',reason:'Synthetic false positive'},actor);
 assert.equal(await prisma.activityLog.count({where:{entityId:alert.id}}),2);
 await prisma.revenueAlert.update({where:{id:alert.id},data:{status:'RESOLVED'}});await assert.rejects(reviewAlert({id:alert.id,status:'REVIEWED'},actor),/reconciled/);
 console.log('Guardian review passed: cross-role denial, explicit custom grant, branch isolation, assignment, required reason, history and resolved-alert protection.');
}finally{await prisma.activityLog.deleteMany({where:{entityId:alert.id}});await prisma.revenueAlert.delete({where:{id:alert.id}})}}
main().finally(()=>prisma.$disconnect());
