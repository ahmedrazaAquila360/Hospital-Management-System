import {NextResponse} from "next/server";
import {prisma,withBranch} from "@/lib/prisma";
import {calendarDay} from "@/lib/report-calendar";
import {hospitalZone} from "@/server/reports/calendar";
import {boardBranch} from "@/server/waiting-board/token";
export async function GET(request:Request){
 const token=new URL(request.url).searchParams.get('display');let branchId='branch-main';
 if(token){try{branchId=boardBranch(token)}catch{return NextResponse.json({error:'Invalid display link.'},{status:403,headers:{'Cache-Control':'no-store'}})}}
 return withBranch(branchId,async()=>{
 const branch=await prisma.branch.findFirst({where:{id:branchId},select:{name:true}});
 if(!branch)return NextResponse.json({error:'Display unavailable.'},{status:404});
 const zone=await hospitalZone();const day=calendarDay(zone);
 const rows=await prisma.encounter.findMany({where:{appointment:{is:{date:new Date(day),status:{in:["CHECKED_IN","IN_PROGRESS"]}}}},select:{token:true,appointment:{select:{status:true,dentist:{select:{name:true}},department:{select:{name:true}}}}},orderBy:{checkedInAt:"asc"},take:50});
 const response=NextResponse.json({day,queue:rows.map(r=>({token:r.token,status:r.appointment?.status,doctor:r.appointment?.dentist.name,department:r.appointment?.department?.name??"General"}))});
 response.headers.set("Cache-Control","no-store");return response;
 });
}
