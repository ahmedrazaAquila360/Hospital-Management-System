import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {prisma} from "../src/lib/prisma";
import {calendarDay} from "../src/lib/report-calendar";
import {hospitalZone} from "../src/server/reports/calendar";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const url=process.env.WAITING_BOARD_TEST_URL;
 assert(url,"Set WAITING_BOARD_TEST_URL to the local development server.");
 const tag=randomUUID();
 const role=await prisma.role.findFirstOrThrow({where:{name:"DENTIST"}});
 const doctor=await prisma.user.create({data:{name:"Synthetic board doctor",email:`board-${tag}@example.invalid`,passwordHash:"synthetic-disabled",roleId:role.id}});
 const patient=await prisma.patient.create({data:{patientCode:`board-${tag}`,fullName:"Private synthetic board patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"000"}});
 const day=calendarDay(await hospitalZone());
 const appt=await prisma.appointment.create({data:{patientId:patient.id,dentistId:doctor.id,date:new Date(day),startTime:new Date(`${day}T04:00:00Z`),endTime:new Date(`${day}T04:30:00Z`),status:"CHECKED_IN"}});
 const encounter=await prisma.encounter.create({data:{appointmentId:appt.id}});
 try{
  const response=await fetch(url,{cache:"no-store"});
  assert.equal(response.status,200);
  assert.equal(response.headers.get("cache-control"),"no-store");
  const body=await response.text();
  assert(body.includes(String(encounter.token)));
  assert(!body.includes(patient.fullName));
  assert(!body.includes(patient.patientCode));
  assert(!body.includes(patient.id));
  console.log("Waiting board passed: live token visible, patient identity absent, no-store response.");
 }finally{
  await prisma.encounter.delete({where:{id:encounter.id}});
  await prisma.appointment.delete({where:{id:appt.id}});
  await prisma.patient.delete({where:{id:patient.id}});
  await prisma.user.delete({where:{id:doctor.id}});
 }
}
main().finally(()=>prisma.$disconnect());
