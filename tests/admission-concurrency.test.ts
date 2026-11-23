import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { createAdmission, changeAdmission, postAdmissionDeposit } from "../src/server/admissions/transactions";

const form = (values: Record<string, string> = {}) => { const result = new FormData(); for (const [key,value] of Object.entries(values)) result.set(key,value); return result; };
const winners = (results: PromiseSettledResult<unknown>[]) => results.filter(r => r.status === "fulfilled").length;
async function main() {
  assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS, "1", "Opt in against a dedicated development database.");
  const tag = `ipd-test-${randomUUID()}`;
  const actor = await prisma.user.findFirstOrThrow({ where: { email: "admin@hospital.example" } });
  const doctor = await prisma.user.findFirstOrThrow({ where: { role: { name: "DENTIST" }, department: { active: true }, status: "ACTIVE" } });
  const patientIds: string[] = [];
  const bedIds: string[] = [];
  try {
    const patients: { id: string; patientCode: string }[] = [];
    for (let i=0;i<7;i++) { const patient = await prisma.patient.create({ data: { patientCode: `${tag}-${i}`, fullName: "Synthetic admission contention", dob: new Date("2000-01-01"), gender: "OTHER", phone: "0000000000" } }); patients.push(patient); patientIds.push(patient.id); }
    for (let i=0;i<11;i++) { const bed=await prisma.bed.create({ data: { ward: tag, room: "Test", label: String(i), category: "Synthetic", nightlyRate: 100 } }); bedIds.push(bed.id); }
    const admit = (p: number,b: number, reserved=false, actorId=actor.id, initialDeposit=0) => createAdmission({ patientCode: patients[p].patientCode, doctorId: doctor.id, bedId: bedIds[b], diagnosis: tag }, reserved, initialDeposit, "CASH", actorId);
    const sameBed=await Promise.allSettled([admit(0,0,false,actor.id,25),admit(1,0,false,actor.id,25)]);
    assert.equal(winners(sameBed),1);
    assert.equal(await prisma.payment.count({where:{patientId:{in:[patients[0].id,patients[1].id]}}}),1);
    assert.equal(await prisma.admission.count({ where: { bedId: bedIds[0] } }),1);
    assert.equal(await prisma.encounter.count({ where: { admission: { bedId: bedIds[0] } } }),1);
    const samePatient=await Promise.allSettled([admit(2,1),admit(2,2)]);
    assert.equal(winners(samePatient),1);
    assert.equal(await prisma.bed.count({ where: { id: { in: [bedIds[1],bedIds[2]] }, status: "AVAILABLE" } }),1);
    const a=await prisma.admission.findFirstOrThrow({ where: { patientId: patients[2].id } });
    const transfer = (id: string, from: string, to: string, actorId=actor.id) => changeAdmission(id,"transfer",form({ expectedBedId:from, bedId:to }),actorId);
    const transfers=await Promise.allSettled([transfer(a.id,a.bedId,bedIds[3]),transfer(a.id,a.bedId,bedIds[4])]);
    assert.equal(winners(transfers),1);
    assert.ok(transfers.some(r=>r.status==="rejected" && /assignment changed/.test(r.reason.message)));
    assert.equal(await prisma.bedStay.count({ where: { admissionId:a.id } }),2);
    assert.equal(await prisma.bedStay.count({ where: { admissionId:a.id,end:null } }),1);
    assert.equal((await prisma.bed.findUniqueOrThrow({ where: { id:a.bedId } })).status,"CLEANING");
    const second=await admit(3,5);
    const moved=await prisma.admission.findUniqueOrThrow({ where: { id:a.id } });
    const sharedDestination=await Promise.allSettled([transfer(a.id,moved.bedId,bedIds[6]),transfer(second.id,second.bedId,bedIds[6])]);
    assert.equal(winners(sharedDestination),1);
    assert.equal(await prisma.admission.count({ where: { bedId:bedIds[6] } }),1);
    console.log("Admissions/transfers: one allocation per bed/patient, stale transfers rejected, one open stay per transferred admission.");

    const reserved=await admit(4,7,true);
    const decisions=await Promise.allSettled([changeAdmission(reserved.id,"confirm",form(),actor.id),changeAdmission(reserved.id,"cancel",form(),actor.id)]);
    assert.equal(winners(decisions),1);
    const reservation=await prisma.admission.findUniqueOrThrow({ where: { id:reserved.id } });
    const confirmed=reservation.status==="ADMITTED";
    assert.ok(confirmed || reservation.status==="CANCELLED");
    assert.equal((await prisma.bed.findUniqueOrThrow({ where: { id:bedIds[7] } })).status,confirmed?"OCCUPIED":"AVAILABLE");
    assert.equal(await prisma.encounter.count({ where: { admissionId:reserved.id } }),confirmed?1:0);

    const deposit={ id:a.id, amount:"50", expectedTotal:"0", method:"CASH" as const };
    const deposits=await Promise.allSettled(Array.from({ length:8 },()=>postAdmissionDeposit(deposit,actor.id)));
    assert.equal(winners(deposits),1);
    let invoice=await prisma.invoice.findUniqueOrThrow({ where: { invoiceNumber:"IPD-"+a.number }, include: { payments:true,items:true } });
    assert.equal(invoice.payments.length,1);
    assert.equal(invoice.total.toString(),"50");
    await changeAdmission(a.id,"request",form(),actor.id);
    const settlement=await Promise.allSettled([
      postAdmissionDeposit({ ...deposit,expectedTotal:"50",amount:"25" },actor.id),
      changeAdmission(a.id,"discharge",form({ summary:"Synthetic settlement" }),actor.id),
    ]);
    assert.equal(settlement[1].status,"fulfilled");
    const accepted=settlement[0].status==="fulfilled";
    invoice=await prisma.invoice.findUniqueOrThrow({ where: { invoiceNumber:"IPD-"+a.number }, include: { payments:true,items:true } });
    assert.equal(invoice.total.toString(),"100");
    assert.equal(invoice.items.reduce((sum,i)=>sum+Number(i.amount),0),100);
    assert.equal(invoice.payments.reduce((sum,p)=>sum+Number(p.amount),0),accepted?75:50);
    assert.equal(invoice.status,"PARTIALLY_PAID");
    assert.equal(await prisma.bedStay.count({ where: { admissionId:a.id,end:null } }),0);
    const discharged=await prisma.admission.findUniqueOrThrow({ where: { id:a.id } });
    assert.equal(discharged.status,"DISCHARGED");
    assert.equal((await prisma.bed.findUniqueOrThrow({ where: { id:discharged.bedId } })).status,"CLEANING");
    await assert.rejects(postAdmissionDeposit({ ...deposit, expectedTotal:"100" },actor.id), { code:"P2025" });
    console.log("Deposits/discharge: duplicate deposits collected once; racing deposits either settle or reject after discharge without losing money.");

    await changeAdmission(second.id,"request",form(),actor.id);
    const currentSecond=await prisma.admission.findUniqueOrThrow({where:{id:second.id}});
    const dischargeRetries=await Promise.allSettled([
      ...Array.from({ length:4 },()=>changeAdmission(second.id,"discharge",form({ summary:"Synthetic discharge retry" }),actor.id)),
      transfer(second.id,currentSecond.bedId,bedIds[9]),
    ]);
    assert.equal(winners(dischargeRetries),1);
    assert.equal(dischargeRetries[4].status,"rejected");
    assert.equal((await prisma.bed.findUniqueOrThrow({where:{id:bedIds[9]}})).status,"AVAILABLE");
    assert.equal(await prisma.invoice.count({ where: { invoiceNumber:"IPD-"+second.number } }),1);
    assert.equal(await prisma.activityLog.count({ where: { entityId:second.id,action:"DISCHARGE" } }),1);
    const rollback=await admit(5,8);
    await assert.rejects(transfer(rollback.id,rollback.bedId,bedIds[9],"nonexistent-test-actor"),{ code:"P2003" });
    assert.equal((await prisma.admission.findUniqueOrThrow({ where:{id:rollback.id} })).bedId,bedIds[8]);
    assert.equal((await prisma.bed.findUniqueOrThrow({ where:{id:bedIds[9]} })).status,"AVAILABLE");
    assert.equal(await prisma.bedStay.count({ where:{admissionId:rollback.id} }),1);
    await postAdmissionDeposit({ ...deposit,id:rollback.id },actor.id);
    await changeAdmission(rollback.id,"request",form(),actor.id);
    await assert.rejects(changeAdmission(rollback.id,"discharge",form({ summary:"Rollback" }),"nonexistent-test-actor"),{code:"P2003"});
    const preserved=await prisma.invoice.findUniqueOrThrow({ where:{invoiceNumber:"IPD-"+rollback.number},include:{items:true,payments:true} });
    assert.equal(preserved.total.toString(),"50"); assert.equal(preserved.items.length,1); assert.equal(preserved.payments.length,1);
    assert.equal((await prisma.admission.findUniqueOrThrow({ where:{id:rollback.id} })).status,"DISCHARGE_REQUESTED");
    assert.equal((await prisma.bed.findUniqueOrThrow({ where:{id:bedIds[8]} })).status,"OCCUPIED");
    assert.equal(await prisma.bedStay.count({ where:{admissionId:rollback.id,end:null} }),1);
    await assert.rejects(postAdmissionDeposit({ ...deposit,id:rollback.id,expectedTotal:"50" },"nonexistent-test-actor"),{code:"P2003"});
    assert.equal((await prisma.invoice.findUniqueOrThrow({ where:{invoiceNumber:"IPD-"+rollback.number} })).total.toString(),"50");
    await assert.rejects(admit(6,10,false,"nonexistent-test-actor"),{code:"P2003"});
    assert.equal((await prisma.bed.findUniqueOrThrow({ where:{id:bedIds[10]} })).status,"AVAILABLE");
    assert.equal(await prisma.admission.count({ where:{patientId:patients[6].id} }),0);
    console.log("Retries/rollback: discharge bills once; failed admission, transfer, deposit and discharge restore beds, stays and finances.");
  } finally {
    const admissions=await prisma.admission.findMany({ where:{patientId:{in:patientIds}},select:{id:true,number:true} });
    const ids=admissions.map(a=>a.id);
    await prisma.activityLog.deleteMany({ where:{entityId:{in:ids}} });
    await prisma.notification.deleteMany({ where:{userId:doctor.id,title:"New inpatient admission",message:{in:admissions.map(a=>"Admission #"+a.number)}} });
    await prisma.invoice.deleteMany({ where:{patientId:{in:patientIds}} });
    await prisma.encounter.deleteMany({ where:{admissionId:{in:ids}} });
    await prisma.bedStay.deleteMany({ where:{admissionId:{in:ids}} });
    await prisma.admission.deleteMany({ where:{id:{in:ids}} });
    await prisma.bed.deleteMany({ where:{id:{in:bedIds}} });
    await prisma.patient.deleteMany({ where:{id:{in:patientIds}} });
  }
}
main().finally(()=>prisma.$disconnect());
