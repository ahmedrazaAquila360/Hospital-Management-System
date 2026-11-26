import 'dotenv/config';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID,randomBytes} from 'node:crypto';
import path from 'node:path';
import {prisma} from '../src/lib/prisma';
import {basePrisma} from '../src/lib/prisma-base';
import {getClinicSettings} from '../src/server/settings/queries';
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');assert.equal(new URL(process.env.HOSPITAL_DATABASE_URL!).pathname,'/hospital_management_mvp');const origin=process.env.HOSPITAL_TEST_ORIGIN;assert(origin,'Set local HOSPITAL_TEST_ORIGIN.');const token=randomBytes(32).toString('hex');const admin=await basePrisma.user.findUniqueOrThrow({where:{email:'admin@hospital.example'}});const settings=await getClinicSettings();const tag='pdf-'+randomUUID();const doctor=await prisma.user.findFirstOrThrow({where:{email:'doctor@hospital.example'}});
 const patient=await prisma.patient.create({data:{patientCode:tag,fullName:'Synthetic Print Patient - Not For Clinical Use',dob:new Date('2000-01-01'),gender:'OTHER',phone:'0000000000'}});
 try{
 await basePrisma.session.create({data:{sessionToken:token,userId:admin.id,activeBranchId:'branch-main',expires:new Date(Date.now()+600000)}});
 await prisma.clinicSettings.update({where:{id:settings.id},data:{currency:'PKR'}});
 const treatment=await prisma.treatment.create({data:{patientId:patient.id,dentistId:doctor.id,name:'Synthetic currency regression',cost:1200}});
 const raw=await prisma.invoice.create({data:{invoiceNumber:'HINV-'+tag,patientId:patient.id,dentistId:doctor.id,subtotal:1200,total:1200,items:{create:Array.from({length:12},(_,i)=>({description:'Synthetic service '+(i+1)+' with a long description for print layout validation',quantity:1,unitPrice:100,amount:100}))}}});
 const prescription=await prisma.prescription.create({data:{patientId:patient.id,dentistId:doctor.id,instructions:'Synthetic general instructions. This document is generated solely for print validation.',medicines:{create:Array.from({length:20},(_,i)=>({medicineName:'Synthetic medicine '+(i+1),dosage:'Synthetic dose',route:'Synthetic route',frequency:'Synthetic frequency',duration:'Synthetic duration',instructions:'Synthetic medicine instruction with enough text to check wrapping; not for treatment.'}))}},include:{patient:true,dentist:true,medicines:true}});
 const output=process.env.HOSPITAL_PDF_TEST_DIR??'/tmp/pdfs/hospital-v1';await mkdir(output,{recursive:true});
 const download=async(route:string,name:string)=>{const response:Response=await fetch(origin+route,{headers:{cookie:'hospital_session='+token},redirect:'manual'});assert.equal(response.status,200,name);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('cache-control'),'no-store');const bytes=Buffer.from(await response.arrayBuffer());assert(bytes.subarray(0,5).equals(Buffer.from('%PDF-')));assert(bytes.length>1000);await writeFile(path.join(output,name),bytes)};
 assert.equal((await fetch(origin+'/api/invoices/'+raw.id+'/pdf')).status,401);
 for(const route of ['/billing/invoices','/billing/invoices/new?patientId='+patient.id,'/billing/invoices/'+raw.id,'/billing/invoices/'+raw.id+'/print','/billing/payments','/dashboard','/patients','/patients/'+patient.id,'/treatments','/treatments/'+treatment.id,'/treatments/new?patientId='+patient.id,'/treatments/'+treatment.id+'/edit','/expenses','/reports','/dental-chart?patientId='+patient.id+'&tab=procedures']){const response:Response=await fetch(origin+route,{headers:{cookie:'hospital_session='+token},redirect:'manual'});assert.equal(response.status,200,route);const html=await response.text();assert(html.includes('PKR'),route+' must use configured currency');assert(!html.includes('$1,200.00'),route+' must not display USD for a PKR invoice');}
 await download('/api/invoices/'+raw.id+'/pdf','invoice.pdf');
 await prisma.invoice.update({where:{id:raw.id},data:{voidedAt:new Date(),voidedById:admin.id,voidReason:'Synthetic invalid invoice - no amount is due'}});
 const filtered:Response=await fetch(origin+'/billing/invoices?status=VOIDED',{headers:{cookie:'hospital_session='+token},redirect:'manual'});assert.equal(filtered.status,200);assert((await filtered.text()).includes(raw.invoiceNumber));
 await download('/api/invoices/'+raw.id+'/pdf','voided-invoice.pdf');
 await download('/api/prescriptions/'+prescription.id+'/pdf','prescription.pdf');
 console.log('PDF generation passed: invoice, voided invoice and 20-item prescription. Synthetic samples at '+output);
 }finally{await prisma.clinicSettings.update({where:{id:settings.id},data:{currency:settings.currency}});await basePrisma.session.deleteMany({where:{sessionToken:token}});await prisma.prescription.deleteMany({where:{patientId:patient.id}});await prisma.invoice.deleteMany({where:{patientId:patient.id}});await prisma.treatment.deleteMany({where:{patientId:patient.id}});await prisma.patient.delete({where:{id:patient.id}})}
}
main().finally(()=>prisma.$disconnect());
