import {NextResponse} from "next/server";
import {prisma,withBranch} from "@/lib/prisma";
import {calendarDay} from "@/lib/report-calendar";
import {hospitalZone} from "@/server/reports/calendar";
export async function GET(){
 const zone=await hospitalZone();const day=calendarDay(zone);
 // Public lobby display is bound to the original main branch. No patient identifiers are queried.
 const rows=await withBranch("branch-main",()=>prisma.encounter.findMany({where:{appointment:{is:{date:new Date(day),status:{in:["CHECKED_IN","IN_PROGRESS"]}}}},select:{token:true,appointment:{select:{status:true,dentist:{select:{name:true}},department:{select:{name:true}}}}},orderBy:{checkedInAt:"asc"},take:50}));
 const response=NextResponse.json({day,queue:rows.map(r=>({token:r.token,status:r.appointment?.status,doctor:r.appointment?.dentist.name,department:r.appointment?.department?.name??"General"}))});
 response.headers.set("Cache-Control","no-store");return response;
}
