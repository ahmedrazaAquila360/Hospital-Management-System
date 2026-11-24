import "dotenv/config";
import {basePrisma} from "../src/lib/prisma-base";
import {withBranch} from "../src/lib/prisma";
import {processDueFollowUpReminders} from "../src/server/follow-ups/reminder-job";

async function main(){
 const branches=await basePrisma.branch.findMany({select:{id:true}});
 for(const branch of branches){
  const sent=await withBranch(branch.id,processDueFollowUpReminders);
  console.log(`${branch.id}: ${sent} internal reminder(s)`);
 }
}
main().finally(()=>basePrisma.$disconnect());
