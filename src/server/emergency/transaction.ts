import "server-only";
import {prisma,requestBranch} from "@/lib/prisma";
import {requiresPatientAssignment,type SessionUser} from "@/lib/permissions";

export type EmergencyUpdate={id:string;clinicianId?:string;categoryId?:string;transferType:"NONE"|"OPD"|"IPD"|"CLOSE";targetId?:string};
export async function updateEmergencyCase(data:EmergencyUpdate,actor:SessionUser){
 const branchId=await requestBranch();
 return prisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT id FROM "EmergencyCase" WHERE id=${data.id} FOR UPDATE`;
  const before=await tx.emergencyCase.findFirstOrThrow({where:{id:data.id,...(requiresPatientAssignment(actor)?{clinicianId:actor.id}:{})}});
  if(["CLOSED","OPD_TRANSFERRED","IPD_TRANSFERRED"].includes(before.status))throw new Error("This emergency case is historical.");
  const change:{clinicianId?:string|null;categoryId?:string|null;triagedAt?:Date;status?:"REGISTERED"|"TRIAGED"|"OPD_TRANSFERRED"|"IPD_TRANSFERRED"|"CLOSED";appointmentId?:string;admissionId?:string;closedAt?:Date}={};
  if(data.clinicianId){
   if(requiresPatientAssignment(actor)&&data.clinicianId!==actor.id)throw new Error("Doctors cannot reassign another clinician's case.");
   await tx.user.findFirstOrThrow({where:{id:data.clinicianId,status:"ACTIVE",role:{name:"DENTIST"},branchMemberships:{some:{active:true,branchId}}},select:{id:true}});
   change.clinicianId=data.clinicianId;
  }
  if(data.categoryId){
   await tx.triageCategory.findFirstOrThrow({where:{id:data.categoryId,active:true},select:{id:true}});
   change.categoryId=data.categoryId;change.triagedAt=new Date();change.status="TRIAGED";
  }
  if(data.transferType==="OPD"){
   if(!data.targetId)throw new Error("Select the checked-in appointment to transfer into OPD.");
   await tx.appointment.findFirstOrThrow({where:{id:data.targetId,patientId:before.patientId,status:{in:["CHECKED_IN","IN_PROGRESS"]}},select:{id:true}});
   change.appointmentId=data.targetId;change.status="OPD_TRANSFERRED";
  }
  if(data.transferType==="IPD"){
   if(!data.targetId)throw new Error("Select the active admission to transfer into IPD.");
   await tx.admission.findFirstOrThrow({where:{id:data.targetId,patientId:before.patientId,status:{in:["ADMITTED","ACTIVE","TRANSFERRED"]}},select:{id:true}});
   change.admissionId=data.targetId;change.status="IPD_TRANSFERRED";
  }
  if(data.transferType==="CLOSE"){change.status="CLOSED";change.closedAt=new Date();}
  if(!Object.keys(change).length)throw new Error("Choose an update.");
  const updated=await tx.emergencyCase.update({where:{id:before.id},data:change});
  await tx.activityLog.create({data:{userId:actor.id,action:"UPDATE",entityType:"EmergencyCase",entityId:before.id,metadata:{before:{status:before.status,clinicianId:before.clinicianId,categoryId:before.categoryId},after:change}}});
  return updated;
 });
}
