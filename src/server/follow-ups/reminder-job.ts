import "server-only";
import {prisma,requestBranch} from "@/lib/prisma";
import {calendarDay} from "@/lib/report-calendar";
import {hospitalZone} from "@/server/reports/calendar";

/** Run under withBranch for each branch. A conditional update makes retries idempotent. */
export async function processDueFollowUpReminders(){
 const branchId=await requestBranch();
 const today=new Date(calendarDay(await hospitalZone()));
 return prisma.$transaction(async tx=>{
  const due=await tx.followUp.findMany({where:{status:"DUE",dueDate:{lte:today},reminderSentAt:null,patient:{reminderConsent:true},note:{author:{status:"ACTIVE",branchMemberships:{some:{active:true,branchId}}}}},select:{id:true,note:{select:{authorId:true}}}});
  let sent=0;
  for(const task of due){
   const updated=await tx.followUp.updateMany({where:{id:task.id,status:"DUE",reminderSentAt:null},data:{reminderSentAt:new Date()}});
   if(!updated.count)continue;
   await tx.notification.create({data:{userId:task.note.authorId,type:"SYSTEM",title:"Follow-up due",message:"An authorized follow-up needs review.",link:"/follow-ups"}});
   sent++;
  }
  return sent;
 });
}
