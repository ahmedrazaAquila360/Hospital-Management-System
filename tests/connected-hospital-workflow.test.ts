import 'dotenv/config';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {prisma} from '../src/lib/prisma';
import {basePrisma} from '../src/lib/prisma-base';
import {ALL_PERMISSION_KEYS,DEFAULT_ROLE_PERMISSIONS,type SessionUser} from '../src/lib/permissions';
import {patientSchema} from '../src/lib/validations/patient';
import {registerPatient} from '../src/server/patients/register';
import {createAppointment,updateAppointmentStatus} from '../src/server/appointments/service';
import {getWorkingHours} from '../src/server/settings/queries';
import {dayFor,DEFAULT_WORKING_HOURS} from '../src/lib/working-hours';
import {saveEncounterNote} from '../src/server/clinical/notes';
import {signPrescription} from '../src/server/prescriptions/sign';
import {medicationReview} from '../src/server/medications/safety';
import {orderLabTest,advanceLabOrder} from '../src/server/laboratory-workflow';
import {recordVitals} from '../src/server/vitals/service';
import {recordToothCondition} from '../src/server/dental-chart/service';
import {receiveStock} from '../src/server/pharmacy/receive-transaction';
import {dispensePrescription} from '../src/server/pharmacy/dispense-transaction';
import {postInvoicePayment} from '../src/server/billing/payment-transaction';
import {createAdmission,changeAdmission} from '../src/server/admissions/transactions';
const form=(values:Record<string,string>)=>{const f=new FormData();for(const [k,v]of Object.entries(values))f.set(k,v);return f};
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1','Synthetic database opt-in required.');
 const tag='connected-'+randomUUID();
 const admin=await prisma.user.findFirstOrThrow({where:{email:'admin@hospital.example'}});
 const actor:SessionUser={id:admin.id,name:admin.name,email:admin.email,phone:null,avatarUrl:null,role:{name:'ADMIN',label:'Admin'},permissions:[...ALL_PERMISSION_KEYS]};
 const department=await prisma.department.findFirstOrThrow({where:{active:true}});
 const doctorRole=await prisma.role.findUniqueOrThrow({where:{name:'DENTIST'}});
 const labRole=await prisma.role.findUniqueOrThrow({where:{name:'LAB_TECH'}});
 const nurseRole=await prisma.role.findUniqueOrThrow({where:{name:'NURSE'}});
 const doctorRow=await prisma.user.create({data:{name:tag+' doctor',email:tag+'@example.invalid',passwordHash:'disabled-synthetic',roleId:doctorRole.id,departmentId:department.id}});
 const techRow=await prisma.user.create({data:{name:tag+' laboratory',email:tag+'-lab@example.invalid',passwordHash:'disabled-synthetic',roleId:labRole.id}});
 const nurseRow=await prisma.user.create({data:{name:tag+' nurse',email:tag+'-nurse@example.invalid',passwordHash:'disabled-synthetic',roleId:nurseRole.id}});
 const doctor:SessionUser={...actor,id:doctorRow.id,name:doctorRow.name,email:doctorRow.email,role:{name:'DENTIST',label:'Doctor'},permissions:DEFAULT_ROLE_PERMISSIONS.DENTIST};
 const tech:SessionUser={...actor,id:techRow.id,role:{name:'LAB_TECH',label:'Lab technician'},permissions:DEFAULT_ROLE_PERMISSIONS.LAB_TECH};
 const nurse:SessionUser={...actor,id:nurseRow.id,role:{name:'NURSE',label:'Nurse'},permissions:DEFAULT_ROLE_PERMISSIONS.NURSE};
 let patientId='';const bedIds:string[]=[];let testId='';
 try{
  const input=patientSchema.parse({fullName:'Synthetic '+tag,dob:'2000-01-01',gender:'OTHER',phone:'0000000000',allergies:'Synthetic allergy text - not for clinical use'});
  const registered=await Promise.all(Array.from({length:4},()=>registerPatient(input,actor)));
  const patient=registered.find(r=>r.patient)?.patient;assert(patient);patientId=patient.id;
  assert.equal(registered.filter(r=>r.patient).length,1);assert.match(patient.patientCode,/^MRN-/);
  const dental=await prisma.dentalRecord.findUniqueOrThrow({where:{patientId},include:{teeth:true}});assert.equal(dental.teeth.length,32);
  const hours=await getWorkingHours()??DEFAULT_WORKING_HOURS;let date='',start=0;
  for(let i=0;i<14;i++){
   const day=new Date(Date.UTC(2099,0,1+i)).toISOString().slice(0,10);const schedule=dayFor(hours,day).hours;
   const shift=schedule.shifts.find(s=>{const a=s.open.split(':').map(Number),b=s.close.split(':').map(Number);return b[0]*60+b[1]-a[0]*60-a[1]>=30});
   if(!schedule.closed&&shift){date=day;const [h,m]=shift.open.split(':').map(Number);start=h*60+m;break}
  }
  assert(date,'A configured doctor slot is required.');
  await prisma.doctorProfile.create({data:{userId:doctor.id,qualifications:'Synthetic',specialty:'Test',consultationFee:10,hours:JSON.parse(JSON.stringify(hours))}});
  const clock=(n:number)=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  const booking=await createAppointment(actor,{},form({patientId,dentistId:doctor.id,date,startTime:clock(start),endTime:clock(start+30),type:'CONSULTATION'}));assert(booking.appointmentId,booking.error);
  await updateAppointmentStatus(actor,booking.appointmentId,'CHECKED_IN');
  const opd=await prisma.encounter.findUniqueOrThrow({where:{appointmentId:booking.appointmentId}});assert(opd.token>0);
  const receipt=await receiveStock({requestId:randomUUID(),generic:tag,brand:tag,strength:'Synthetic',form:'Test',category:'Synthetic',lot:tag,supplier:tag,expiry:'2099-12-31',purchase:'1.00',price:'3.00',quantity:10},actor);
  const lab=await prisma.labTest.create({data:{name:tag,category:'Synthetic',price:25}});testId=lab.id;
  async function consultation(encounterId:string,appointmentId?:string){
   await assert.rejects(saveEncounterNote(form({encounterId,diagnosis:'Synthetic diagnosis',narrative:'Synthetic note',instructions:'Test only',followUp:''}),nurse));
   const note=await saveEncounterNote(form({encounterId,diagnosis:'Synthetic diagnosis',narrative:'Synthetic note; not for clinical care',instructions:'Test only',followUp:'2099-02-01'}),doctor);
   await recordVitals({encounterId,observedAt:new Date(),values:{pulse:80,saturation:98}},nurse);
   const prescriptionForm=form({patientId,dentistId:doctor.id,appointmentId:appointmentId??'',encounterId,medicineName:tag,dosage:'Synthetic dose',frequency:'Synthetic frequency',duration:'Synthetic duration',instructions:'Test only',reviewedAllergies:input.allergies??''});
   // Deterministic unavailable-identity response, explicitly unverified; no external lookup or invented drug identity.
   const unverifiedReview=(names:string[],allergies:string|null)=>medicationReview(names,allergies,async()=>null);
   const review=await signPrescription(prescriptionForm,doctor,unverifiedReview);assert(review.reviewToken);assert(review.medicationWarnings?.some(w=>w.includes('could not be verified')));
   prescriptionForm.set('medicationReview',review.reviewToken);
   const signed=await signPrescription(prescriptionForm,doctor,unverifiedReview);assert(signed.prescriptionId,signed.error);
   const prescription=await prisma.prescription.findUniqueOrThrow({where:{id:signed.prescriptionId},include:{medicines:true}});assert.equal(prescription.encounterId,encounterId);assert.equal(prescription.patientId,patientId);
   await dispensePrescription({medicineId:prescription.medicines[0].id,batchId:receipt.batchId,quantity:2},actor.id);
   const order=await orderLabTest(form({encounterId,testId:lab.id}),doctor);
   for(const status of ['SAMPLE_PENDING','SAMPLE_COLLECTED','PROCESSING','COMPLETED'])await advanceLabOrder(form({id:order.id,status,sampleId:'sample-'+order.id,result:'Synthetic result only'}),tech);
   await assert.rejects(advanceLabOrder(form({id:order.id,status:'VERIFIED'}),tech));
   await advanceLabOrder(form({id:order.id,status:'VERIFIED'}),actor);await advanceLabOrder(form({id:order.id,status:'RELEASED'}),actor);
   assert.equal(await prisma.activityLog.count({where:{entityType:'Prescription',entityId:prescription.id}}),2);
   return note;
  }
  await consultation(opd.id,booking.appointmentId);
  const tooth=dental.teeth[0];assert.equal((await recordToothCondition({toothId:tooth.id,condition:'CARIES',notes:'Synthetic dental regression'},doctor)).success,true);
  assert.equal((await recordToothCondition({toothId:tooth.id,condition:'HEALTHY'},nurse)).success,false);
  await updateAppointmentStatus(actor,booking.appointmentId,'COMPLETED');
  for(let i=0;i<2;i++){const b=await prisma.bed.create({data:{ward:tag,room:'Synthetic',label:String(i),category:'Test',nightlyRate:100}});bedIds.push(b.id)}
  const admission=await createAdmission({patientCode:patient.patientCode,doctorId:doctor.id,bedId:bedIds[0],diagnosis:'Synthetic admission'},false,25,'CASH',actor.id);
  const ipd=await prisma.encounter.findUniqueOrThrow({where:{admissionId:admission.id}});await consultation(ipd.id);
  await changeAdmission(admission.id,'transfer',form({expectedBedId:bedIds[0],bedId:bedIds[1]}),actor.id);
  await changeAdmission(admission.id,'request',form({}),actor.id);await changeAdmission(admission.id,'discharge',form({summary:'Synthetic signed discharge; not for care'}),actor.id);
  assert.equal((await prisma.bed.findUniqueOrThrow({where:{id:bedIds[1]}})).status,'CLEANING');assert.equal((await prisma.admission.findUniqueOrThrow({where:{id:admission.id}})).status,'DISCHARGED');
  const invoices=await prisma.invoice.findMany({where:{patientId},include:{items:true,payments:true}});assert.equal(invoices.length,6);
  for(const invoice of invoices){assert.equal(invoice.items.reduce((sum,i)=>sum.plus(i.amount),invoice.total.mul(0)).toFixed(2),invoice.total.toFixed(2));const remaining=invoice.total.minus(invoice.payments.reduce((sum,p)=>sum.plus(p.amount),invoice.total.mul(0)));if(remaining.gt(0))assert.equal((await postInvoicePayment({invoiceId:invoice.id,amount:remaining.toNumber(),method:'CASH',requestId:randomUUID()},actor)).error,undefined)}
  assert.equal(await prisma.invoice.count({where:{patientId,status:{not:'PAID'}}}),0);
  assert.equal((await prisma.payment.aggregate({where:{patientId},_sum:{amount:true}}))._sum.amount?.toFixed(2),'172.00');
  assert.equal((await prisma.pharmacyBatch.findUniqueOrThrow({where:{id:receipt.batchId}})).quantity,6);
  assert.equal(await prisma.patient.count({where:{id:patientId}}),1);assert.equal(await prisma.clinicalNote.count({where:{encounterId:{in:[opd.id,ipd.id]}}}),2);assert.equal(await prisma.followUp.count({where:{patientId}}),2);
  assert.equal((await prisma.tooth.findUniqueOrThrow({where:{id:tooth.id}})).currentCondition,'CARIES');
  console.log('Connected hospital workflow passed: one MRN, duplicate detection, retained 32-tooth chart, booking/token, authorized notes and nursing vitals, reviewed prescriptions, independently verified lab, dispensing, admission/deposit/transfer/discharge, six linked invoices and complete 172.00 settlement.');
 }finally{
  if(patientId){
   const [appointments,admissions,invoices,payments,prescriptions,notes,orders,encounters,teeth]=await Promise.all([prisma.appointment.findMany({where:{patientId}}),prisma.admission.findMany({where:{patientId}}),prisma.invoice.findMany({where:{patientId}}),prisma.payment.findMany({where:{patientId}}),prisma.prescription.findMany({where:{patientId}}),prisma.clinicalNote.findMany({where:{authorId:doctor.id}}),prisma.labOrder.findMany({where:{testId}}),prisma.encounter.findMany({where:{OR:[{appointment:{patientId}},{admission:{patientId}}]}}),prisma.tooth.findMany({where:{dentalRecord:{patientId}}})]);
   const fills=await prisma.dispensing.findMany({where:{medicine:{prescription:{patientId}}}});const ids=[patientId,...[appointments,admissions,invoices,payments,prescriptions,notes,orders,teeth,fills].flatMap(rows=>rows.map(r=>r.id))];
   await prisma.activityLog.deleteMany({where:{OR:[{entityId:{in:ids}},{userId:{in:[doctor.id,tech.id,nurse.id]}}]}});
   await prisma.notification.deleteMany({where:{OR:[{userId:{in:[doctor.id,tech.id,nurse.id]}},{link:'/patients/'+patientId},{link:{in:invoices.map(i=>'/billing/invoices/'+i.id)}},{link:'/pharmacy',message:{contains:tag}}]}});
   await prisma.followUp.deleteMany({where:{patientId}});await basePrisma.vitalReview.deleteMany({where:{observation:{encounterId:{in:encounters.map(e=>e.id)}}}});await basePrisma.vitalObservation.deleteMany({where:{encounterId:{in:encounters.map(e=>e.id)}}});await prisma.clinicalNote.deleteMany({where:{authorId:doctor.id}});await prisma.dispensing.deleteMany({where:{id:{in:fills.map(f=>f.id)}}});await prisma.payment.deleteMany({where:{patientId}});await prisma.invoice.deleteMany({where:{patientId}});await prisma.prescription.deleteMany({where:{patientId}});await prisma.labOrder.deleteMany({where:{testId}});await prisma.encounter.deleteMany({where:{id:{in:encounters.map(e=>e.id)}}});await prisma.bedStay.deleteMany({where:{admissionId:{in:admissions.map(a=>a.id)}}});await prisma.admission.deleteMany({where:{patientId}});await prisma.appointment.deleteMany({where:{patientId}});await prisma.patient.delete({where:{id:patientId}});
  }
  if(testId)await prisma.labTest.delete({where:{id:testId}});await prisma.bed.deleteMany({where:{id:{in:bedIds}}});
  const batches=await prisma.pharmacyBatch.findMany({where:{medication:{generic:tag}}});const batchIds=batches.map(b=>b.id);await prisma.activityLog.deleteMany({where:{entityId:{in:batchIds}}});await basePrisma.pharmacyReceipt.deleteMany({where:{batchId:{in:batchIds}}});await basePrisma.stockMovement.deleteMany({where:{batchId:{in:batchIds}}});await prisma.pharmacyBatch.deleteMany({where:{id:{in:batchIds}}});await prisma.medication.deleteMany({where:{generic:tag}});await basePrisma.supplier.deleteMany({where:{name:tag}});await prisma.doctorProfile.deleteMany({where:{userId:doctor.id}});await prisma.user.deleteMany({where:{id:{in:[doctor.id,tech.id,nurse.id]}}});
 }
}
main().finally(()=>prisma.$disconnect());
