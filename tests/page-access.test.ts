import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {basePrisma} from '../src/lib/prisma-base';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');const origin=process.env.HOSPITAL_TEST_ORIGIN;assert(origin,'Set HOSPITAL_TEST_ORIGIN to the local synthetic server.');const checks:{role:string;allowed:string[];denied:string[]}[]=[
{role:'ADMIN',allowed:['/billing/guardian','/attendance','/vitals','/pharmacy/ledger','/guidance','/settings/waiting-board'],denied:[]},
{role:'CASHIER',allowed:['/billing/guardian','/attendance','/guidance'],denied:['/vitals','/pharmacy/ledger','/emergency','/follow-ups']},
{role:'NURSE',allowed:['/vitals','/attendance','/guidance'],denied:['/billing/guardian','/pharmacy/ledger']},
{role:'LAB_TECH',allowed:['/laboratory','/attendance','/guidance'],denied:['/billing/guardian','/vitals','/pharmacy/ledger']},
{role:'PHARMACIST',allowed:['/pharmacy','/pharmacy/ledger','/attendance','/guidance'],denied:['/billing/guardian','/vitals']}
];
for(const check of checks){const role=await basePrisma.role.findUniqueOrThrow({where:{name:check.role}});const user=await basePrisma.user.create({data:{name:'Synthetic page access',email:'page-'+randomUUID()+'@example.invalid',passwordHash:'disabled-synthetic',roleId:role.id}});const token=randomBytes(32).toString('hex');try{await basePrisma.branchMembership.upsert({where:{userId_branchId:{userId:user.id,branchId:'branch-main'}},create:{userId:user.id,branchId:'branch-main'},update:{active:true}});await basePrisma.session.create({data:{sessionToken:token,userId:user.id,activeBranchId:'branch-main',expires:new Date(Date.now()+600000)}});
for(const route of check.allowed){const r:Response=await fetch(origin+route,{headers:{cookie:'hospital_session='+token},redirect:'manual'});const body=await r.text();assert.equal(r.status,200,check.role+' '+route);assert(!body.includes('Application error: a server-side exception'),route+' failed to render');}
for(const route of check.denied){const r:Response=await fetch(origin+route,{headers:{cookie:'hospital_session='+token},redirect:'manual'});assert([303,307].includes(r.status),check.role+' '+route+' expected denial, got '+r.status);assert(r.headers.get('location')?.includes('/no-access'),check.role+' '+route);}
console.log('PASS page access '+check.role);
}finally{await basePrisma.session.deleteMany({where:{userId:user.id}});await basePrisma.branchMembership.deleteMany({where:{userId:user.id}});await basePrisma.user.delete({where:{id:user.id}})}}
assert.equal((await fetch(origin+'/api/health')).status,401);assert.equal((await fetch(origin+'/api/jobs/follow-up-reminders',{method:'POST'})).status,401);assert.equal((await fetch(origin+'/api/waiting-board?display=forged')).status,403);console.log('Protected job/health denial and forged waiting display denial passed.');}
main().finally(()=>basePrisma.$disconnect());
