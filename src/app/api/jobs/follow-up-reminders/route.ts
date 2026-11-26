import {NextResponse} from 'next/server';
import {jobAuthorized} from '@/server/jobs/auth';
import {basePrisma} from '@/lib/prisma-base';
import {withBranch} from '@/lib/prisma';
import {processDueFollowUpReminders} from '@/server/follow-ups/reminder-job';
export async function POST(request:Request){
 if(!jobAuthorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{const branches=await basePrisma.branch.findMany({select:{id:true}});let sent=0;for(const branch of branches)sent+=await withBranch(branch.id,processDueFollowUpReminders);console.info(JSON.stringify({event:'follow_up_job',status:'success',branches:branches.length,sent}));return NextResponse.json({ok:true,sent},{headers:{'Cache-Control':'no-store'}});}catch{console.error(JSON.stringify({event:'follow_up_job',status:'failed'}));return NextResponse.json({error:'Reminder job failed.'},{status:503});}
}
