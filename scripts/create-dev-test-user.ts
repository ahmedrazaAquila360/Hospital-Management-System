import 'dotenv/config';
import {randomBytes} from 'node:crypto';
import {basePrisma} from '../src/lib/prisma-base';
import {hashPassword,verifyPassword} from '../src/lib/auth/password';
async function main(){
 if(process.env.NODE_ENV==='production'||!process.env.HOSPITAL_DATABASE_URL||new URL(process.env.HOSPITAL_DATABASE_URL).pathname!=='/hospital_management_mvp')throw new Error('Test accounts can only be created in the synthetic hospital_management_mvp database.');
 const email='v1.test.admin@hospital.example',password=randomBytes(24).toString('base64url');const role=await basePrisma.role.findUniqueOrThrow({where:{name:'ADMIN'}});
 const user=await basePrisma.user.upsert({where:{email},create:{name:'V1 Synthetic Test Admin',email,passwordHash:await hashPassword(password),roleId:role.id},update:{passwordHash:await hashPassword(password),status:'ACTIVE',roleId:role.id},omit:{passwordHash:false}});
 await basePrisma.branchMembership.upsert({where:{userId_branchId:{userId:user.id,branchId:'branch-main'}},create:{userId:user.id,branchId:'branch-main',active:true},update:{active:true}});
 if(!await verifyPassword(password,user.passwordHash))throw new Error('Password verification failed.');
 console.log('Development account only\nEmail: '+email+'\nPassword: '+password);
}
main().finally(()=>basePrisma.$disconnect());
