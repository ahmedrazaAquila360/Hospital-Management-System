import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { ALL_PERMISSION_KEYS, type SessionUser } from "../src/lib/permissions";
import { createAppointment, updateAppointment, updateAppointmentStatus, rescheduleAppointment } from "../src/server/appointments/service";
import { appointmentInstant } from "../src/server/appointments/clock";
import { getWorkingHours } from "../src/server/settings/queries";
import { dayFor, DEFAULT_WORKING_HOURS } from "../src/lib/working-hours";
import { appointmentSchema } from "../src/lib/validations/appointment";

const form = (values: Record<string,string>) => { const f=new FormData(); for(const [k,v] of Object.entries(values))f.set(k,v); return f; };
const time = (minutes:number) => `${String(Math.floor(minutes/60)).padStart(2,"0")}:${String(minutes%60).padStart(2,"0")}`;
async function main() {
  assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
  const tag=`appointment-test-${randomUUID()}`;
  const role=await prisma.role.findUniqueOrThrow({where:{name:"DENTIST"}});
  const doctor=await prisma.user.create({data:{name:tag,email:tag+"@hospital.example",passwordHash:"unusable-test-hash",roleId:role.id}});
  const actor:SessionUser={id:doctor.id,name:doctor.name,email:doctor.email,phone:null,avatarUrl:null,role:{name:"ADMIN",label:"Test admin"},permissions:[...ALL_PERMISSION_KEYS]};
  const patient=await prisma.patient.create({data:{patientCode:tag,fullName:"Synthetic appointment patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"0000000000"}});
  const unrelated=await prisma.patient.create({data:{patientCode:tag+"-other",fullName:"Unassigned synthetic patient",dob:new Date("2000-01-01"),gender:"OTHER",phone:"0000000000"}});
  try {
    const hours=await getWorkingHours() ?? DEFAULT_WORKING_HOURS;
    let date="2099-01-01", minutes=540;
    for(let i=0;i<14;i++) {
      const d=new Date(Date.UTC(2099,0,1+i)); const day=d.toISOString().slice(0,10); const shifts=dayFor(hours,day).hours;
      const shift=shifts.shifts.find(s=>{const [h,m]=s.open.split(":").map(Number);const [eh,em]=s.close.split(":").map(Number);return eh*60+em-h*60-m>=120;});
      if(!shifts.closed && shift){date=day;const [h,m]=shift.open.split(":").map(Number);minutes=h*60+m;break;}
    }
    await prisma.doctorProfile.create({data:{userId:doctor.id,qualifications:"Synthetic",specialty:"Test",consultationFee:12.5,hours:JSON.parse(JSON.stringify(hours))}});
    const fields={patientId:patient.id,dentistId:doctor.id,date,startTime:time(minutes),endTime:time(minutes+30),type:"CONSULTATION",notes:"Synthetic regression"};
    assert.equal(appointmentSchema.safeParse({...fields,date:"2026-02-30"}).success,false);
    assert.equal(appointmentSchema.safeParse({...fields,startTime:"25:00"}).success,false);
    assert.equal(appointmentSchema.safeParse({...fields,endTime:fields.startTime}).success,false);
    assert.ok((await createAppointment(actor,{},form({...fields,startTime:"23:00",endTime:"23:30"}))).error);
    const attempts=await Promise.allSettled(Array.from({length:8},()=>createAppointment(actor,{},form(fields))));
    const created=await prisma.appointment.findMany({where:{patientId:patient.id}});
    assert.equal(created.length,1);
    assert.ok(attempts.some(r=>r.status==="fulfilled" && r.value.appointmentId));
    const id=created[0].id;
    const adjacent=await createAppointment(actor,{},form({...fields,startTime:time(minutes+30),endTime:time(minutes+60)}));
    assert.ok(adjacent.appointmentId);
    const overlap=await rescheduleAppointment(actor,adjacent.appointmentId!,{date,startTime:time(minutes+15),endTime:time(minutes+45)});
    assert.equal(overlap.ok,false);
    assert.equal((await prisma.appointment.findUniqueOrThrow({where:{id:adjacent.appointmentId}})).startTime.getTime(),(await appointmentInstant(date,time(minutes+30))).getTime());
    const moved=await rescheduleAppointment(actor,adjacent.appointmentId!,{date,startTime:time(minutes+60),endTime:time(minutes+90)});
    assert.equal(moved.ok,true);
    await updateAppointmentStatus(actor,adjacent.appointmentId!,"NO_SHOW");
    assert.equal((await rescheduleAppointment(actor,adjacent.appointmentId!,{date,startTime:time(minutes+30),endTime:time(minutes+60)})).ok,true);
    assert.equal((await prisma.appointment.findUniqueOrThrow({where:{id:adjacent.appointmentId}})).status,"SCHEDULED");
    await updateAppointmentStatus(actor,adjacent.appointmentId!,"CANCELLED");
    assert.equal((await rescheduleAppointment(actor,adjacent.appointmentId!,{date,startTime:time(minutes+60),endTime:time(minutes+90)})).ok,false);
    assert.ok((await updateAppointment(actor,adjacent.appointmentId!,{},form(fields))).error);
    await Promise.allSettled(Array.from({length:8},()=>updateAppointmentStatus(actor,id,"CHECKED_IN")));
    assert.equal(await prisma.encounter.count({where:{appointmentId:id}}),1);
    assert.ok((await updateAppointment(actor,id,{},form({...fields,notes:"Overwrite"}))).error);
    assert.equal((await rescheduleAppointment(actor,id,{date,startTime:time(minutes+60),endTime:time(minutes+90)})).ok,false);
    await updateAppointmentStatus(actor,id,"IN_PROGRESS");
    assert.equal((await updateAppointmentStatus(actor,id,"NO_SHOW")).ok,false);
    await Promise.allSettled(Array.from({length:8},()=>updateAppointmentStatus(actor,id,"COMPLETED")));
    assert.equal(await prisma.invoice.count({where:{invoiceNumber:"OPD-"+id}}),1);
    assert.equal((await prisma.invoice.findUniqueOrThrow({where:{invoiceNumber:"OPD-"+id}})).total.toString(),"12.5");
    assert.ok((await updateAppointment(actor,id,{},form(fields))).error);
    assert.equal((await updateAppointmentStatus(actor,id,"SCHEDULED")).ok,false);
    const denied={...actor,role:{name:"DENTIST",label:"Doctor"}};
    assert.ok((await createAppointment(denied,{},form({...fields,patientId:unrelated.id,startTime:time(minutes+60),endTime:time(minutes+90)}))).error);
    const walkIn=await createAppointment(actor,{},form({...fields,startTime:time(minutes+60),endTime:time(minutes+90),walkIn:"on"}));
    assert.ok(walkIn.appointmentId);
    assert.equal(await prisma.encounter.count({where:{appointmentId:walkIn.appointmentId}}),1);
    const invalidActor={...actor,id:"missing-test-actor"};
    await assert.rejects(createAppointment(invalidActor,{},form({...fields,startTime:time(minutes+90),endTime:time(minutes+120)})));
    assert.equal(await prisma.appointment.count({where:{patientId:patient.id}}),3);
    console.log("Appointments passed: overlap/adjacency, reschedule/no-show/cancellation, one encounter and bill, immutable clinical visits, walk-in, assignment denial and rollback.");
    assert.equal((await appointmentInstant("2026-11-23","09:00","Asia/Karachi")).toISOString(),"2026-11-23T04:00:00.000Z");
    await assert.rejects(appointmentInstant("2026-03-08","02:30","America/New_York"),/does not exist/);
    console.log("Timezone/date checks passed: hospital local time, DST gap and invalid dates.");
  } finally {
    const appointments=await prisma.appointment.findMany({where:{patientId:patient.id},select:{id:true}});const ids=appointments.map(a=>a.id);
    await prisma.activityLog.deleteMany({where:{userId:doctor.id}});
    await prisma.notification.deleteMany({where:{userId:doctor.id}});
    await prisma.invoice.deleteMany({where:{patientId:patient.id}});
    await prisma.encounter.deleteMany({where:{appointmentId:{in:ids}}});
    await prisma.appointment.deleteMany({where:{id:{in:ids}}});
    await prisma.patient.deleteMany({where:{id:{in:[patient.id,unrelated.id]}}});await prisma.doctorProfile.deleteMany({where:{userId:doctor.id}});await prisma.user.delete({where:{id:doctor.id}});
  }
}
main().finally(()=>prisma.$disconnect());
