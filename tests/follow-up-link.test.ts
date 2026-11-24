import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {ALL_PERMISSION_KEYS,type SessionUser} from "../src/lib/permissions";
import {createAppointment,updateAppointmentStatus} from "../src/server/appointments/service";
import {getWorkingHours} from "../src/server/settings/queries";
import {DEFAULT_WORKING_HOURS,dayFor} from "../src/lib/working-hours";

const form=(data:Record<string,string>)=>{const f=new FormData();for(const [k,v] of Object.entries(data))f.set(k,v);return f};
const time=(n:number)=>`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`;
async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const role=await prisma.role.findFirstOrThrow({where:{name:"DENTIST"}});
 const doctor=await prisma.user.create({data:{name:"Synthetic follow-up doctor",email:`follow-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:role.id}});
 const actor:SessionUser={id:doctor.id,name:doctor.name,email:doctor.email,phone:null,avatarUrl:null,role:{name:"ADMIN",label:"Test admin"},permissions:[...ALL_PERMISSION_KEYS]};
 const patient=await prisma.patient.create({data:{patientCode:`follow-${tag}`,fullName:"Synthetic follow-up patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const initial=await prisma.appointment.create({data:{patientId:patient.id,dentistId:doctor.id,date:new Date("2098-01-01"),startTime:new Date("2098-01-01T04:00:00Z"),endTime:new Date("2098-01-01T04:30:00Z"),status:"COMPLETED"}});
 const encounter=await prisma.encounter.create({data:{appointmentId:initial.id}});
 const note=await prisma.clinicalNote.create({data:{encounterId:encounter.id,authorId:doctor.id,diagnosis:"Synthetic",narrative:"Synthetic history",followUp:new Date("2099-01-01")}});
 let linkedId:string|undefined;
 try{
  const hours=await getWorkingHours()??DEFAULT_WORKING_HOURS;
  let day="",start=540;
  for(let i=0;i<14;i++){
   const candidate=new Date(Date.UTC(2099,0,1+i)).toISOString().slice(0,10);
   const setting=dayFor(hours,candidate).hours;
   const shift=setting.shifts.find(s=>{const [h,m]=s.open.split(":").map(Number);const [eh,em]=s.close.split(":").map(Number);return eh*60+em-h*60-m>=60});
   if(!setting.closed&&shift){day=candidate;const [h,m]=shift.open.split(":").map(Number);start=h*60+m;break}
  }
  assert(day);
  const task=await prisma.followUp.create({data:{patientId:patient.id,noteId:note.id,dueDate:new Date(day)}});
  const fields={patientId:patient.id,dentistId:doctor.id,date:day,startTime:time(start),endTime:time(start+30),type:"FOLLOW_UP",notes:"Synthetic"};
  const booked=await createAppointment(actor,{},form(fields));assert(booked.appointmentId);linkedId=booked.appointmentId;
  assert.equal((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).status,"BOOKED");
  await updateAppointmentStatus(actor,linkedId!,"CANCELLED");
  assert.equal((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).status,"DUE");
  const again=await createAppointment(actor,{},form({...fields,startTime:time(start+30),endTime:time(start+60)}));assert(again.appointmentId);
  assert.equal((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).appointmentId,again.appointmentId);
  await updateAppointmentStatus(actor,again.appointmentId!,"CHECKED_IN");
  await updateAppointmentStatus(actor,again.appointmentId!,"IN_PROGRESS");
  await updateAppointmentStatus(actor,again.appointmentId!,"COMPLETED");
  assert.equal((await prisma.followUp.findUniqueOrThrow({where:{id:task.id}})).status,"COMPLETED");
  console.log("Follow-up passed: exact due task links to booking, cancellation reopens, completed visit closes task.");
 }finally{
  const appointments=await prisma.appointment.findMany({where:{patientId:patient.id},select:{id:true}});
  await prisma.followUp.deleteMany({where:{patientId:patient.id}});
  await prisma.activityLog.deleteMany({where:{userId:doctor.id}});
  await prisma.notification.deleteMany({where:{userId:doctor.id}});
  await prisma.invoice.deleteMany({where:{patientId:patient.id}});
  await prisma.clinicalNote.delete({where:{id:note.id}});
  await prisma.encounter.deleteMany({where:{appointmentId:{in:appointments.map(a=>a.id)}}});
  await prisma.appointment.deleteMany({where:{id:{in:appointments.map(a=>a.id)}}});
  await prisma.patient.delete({where:{id:patient.id}});
  await prisma.user.delete({where:{id:doctor.id}});
 }
}
main().finally(()=>prisma.$disconnect());
