import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {ALL_PERMISSION_KEYS,type SessionUser} from "../src/lib/permissions";
import {updateEmergencyCase} from "../src/server/emergency/transaction";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const tag=randomUUID();
 const admin=await prisma.user.findFirstOrThrow({where:{email:"admin@hospital.example"}});
 const doctorRole=await prisma.role.findFirstOrThrow({where:{name:"DENTIST"}});
 const doctor=await prisma.user.create({data:{name:"Synthetic emergency doctor",email:`emergency-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:doctorRole.id}});
 const department=await prisma.department.findFirstOrThrow();
 const actor:SessionUser={id:admin.id,name:admin.name,email:admin.email,phone:null,avatarUrl:null,role:{name:"ADMIN",label:"Admin"},permissions:[...ALL_PERMISSION_KEYS]};
 const clinician={...actor,id:doctor.id,role:{name:"DENTIST",label:"Doctor"}};
 const patient=await prisma.patient.create({data:{patientCode:`em-${tag}`,fullName:"Synthetic emergency patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const other=await prisma.patient.create({data:{patientCode:`em-other-${tag}`,fullName:"Other patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const category=await prisma.triageCategory.create({data:{name:`Draft ${tag}`,priority:1,color:"#ff0000",escalationRule:"Awaiting clinical approval"}});
 const appointment=await prisma.appointment.create({data:{patientId:patient.id,dentistId:doctor.id,date:new Date("2099-01-01"),startTime:new Date("2099-01-01T04:00:00Z"),endTime:new Date("2099-01-01T04:30:00Z"),status:"CHECKED_IN"}});
 const otherAppointment=await prisma.appointment.create({data:{patientId:other.id,dentistId:doctor.id,date:new Date("2099-01-01"),startTime:new Date("2099-01-01T04:30:00Z"),endTime:new Date("2099-01-01T05:00:00Z"),status:"CHECKED_IN"}});
 const bed=await prisma.bed.create({data:{ward:`Synthetic ${tag}`,room:"1",label:"1",category:"General"}});
 const admission=await prisma.admission.create({data:{patientId:patient.id,doctorId:doctor.id,departmentId:department.id,bedId:bed.id,diagnosis:"Synthetic",status:"ACTIVE"}});
 const opd=await prisma.emergencyCase.create({data:{patientId:patient.id,presentingConcern:"Synthetic concern",recordedById:admin.id}});
 const ipd=await prisma.emergencyCase.create({data:{patientId:patient.id,presentingConcern:"Synthetic admission",recordedById:admin.id}});
 try{
  await assert.rejects(()=>updateEmergencyCase({id:opd.id,categoryId:category.id,transferType:"NONE"},actor));
  await assert.rejects(()=>updateEmergencyCase({id:opd.id,transferType:"OPD",targetId:otherAppointment.id},actor));
  await updateEmergencyCase({id:opd.id,clinicianId:doctor.id,transferType:"NONE"},actor);
  await assert.rejects(()=>updateEmergencyCase({id:opd.id,clinicianId:admin.id,transferType:"NONE"},clinician),/cannot reassign/);
  await updateEmergencyCase({id:opd.id,transferType:"OPD",targetId:appointment.id},clinician);
  assert.equal((await prisma.emergencyCase.findUniqueOrThrow({where:{id:opd.id}})).status,"OPD_TRANSFERRED");
  await updateEmergencyCase({id:ipd.id,transferType:"IPD",targetId:admission.id},actor);
  assert.equal((await prisma.emergencyCase.findUniqueOrThrow({where:{id:ipd.id}})).admissionId,admission.id);
  await assert.rejects(()=>updateEmergencyCase({id:opd.id,transferType:"CLOSE"},actor),/historical/);
  console.log("Emergency passed: inactive triage blocked, wrong-patient transfer denied, clinician scope and OPD/IPD links retained.");
 }finally{
  await prisma.activityLog.deleteMany({where:{entityType:"EmergencyCase",entityId:{in:[opd.id,ipd.id]}}});
  await prisma.emergencyCase.deleteMany({where:{id:{in:[opd.id,ipd.id]}}});
  await prisma.admission.delete({where:{id:admission.id}});
  await prisma.bed.delete({where:{id:bed.id}});
  await prisma.appointment.deleteMany({where:{id:{in:[appointment.id,otherAppointment.id]}}});
  await prisma.triageCategory.delete({where:{id:category.id}});
  await prisma.patient.deleteMany({where:{id:{in:[patient.id,other.id]}}});
  await prisma.user.delete({where:{id:doctor.id}});
 }
}
main().finally(()=>prisma.$disconnect());
