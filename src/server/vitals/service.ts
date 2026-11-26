import 'server-only';
import {z} from 'zod';
import {prisma} from '@/lib/prisma';
import {can,requiresPatientAssignment,type SessionUser} from '@/lib/permissions';
import {encounterScope} from '@/server/encounters/scope';
export const vitalNames={systolic:'Systolic BP (mmHg)',diastolic:'Diastolic BP (mmHg)',temperature:'Temperature (°C)',pulse:'Pulse (beats/min)',respirations:'Respiratory rate (breaths/min)',saturation:'Oxygen saturation (%)',weight:'Weight (kg)',height:'Height (cm)'} as const;
const valuesSchema=z.object({systolic:z.number().positive().max(10000).optional(),diastolic:z.number().positive().max(10000).optional(),temperature:z.number().positive().max(10000).optional(),pulse:z.number().positive().max(10000).optional(),respirations:z.number().positive().max(10000).optional(),saturation:z.number().min(0).max(100).optional(),weight:z.number().positive().max(10000).optional(),height:z.number().positive().max(10000).optional()}).strict().refine(v=>Object.values(v).some(n=>n!==undefined),'Record at least one observation.');
export function vitalScope(actor:SessionUser){return requiresPatientAssignment(actor)?encounterScope(actor):{};}
export async function recordVitals(input:{encounterId:string;observedAt:Date;values:Record<string,number>;correctionOfId?:string;reason?:string},actor:SessionUser){
 if(!can(actor,'vitals.create')||!can(actor,'vitals.view'))throw new Error('Vital entry permission required.');
 const values=valuesSchema.parse(input.values);z.date().max(new Date(Date.now()+60000),'Observation cannot be in the future.').parse(input.observedAt);
 return prisma.$transaction(async tx=>{
 const encounter=await tx.encounter.findFirstOrThrow({where:{id:input.encounterId,...vitalScope(actor)},include:{appointment:true,admission:true}});
 if(encounter.admission?.dischargedAt||encounter.appointment&&['CANCELLED','NO_SHOW'].includes(encounter.appointment.status))throw new Error('This encounter is closed for vital entry.');
 if(input.correctionOfId){
 if(!input.reason||input.reason.trim().length<3||input.reason.length>1000)throw new Error('A correction reason is required.');
 const prior=await tx.vitalObservation.findFirstOrThrow({where:{id:input.correctionOfId,encounterId:input.encounterId},include:{correction:true}});
 if(prior.correction)throw new Error('This observation was already corrected.');
 }
 const row=await tx.vitalObservation.create({data:{encounterId:input.encounterId,authorId:actor.id,observedAt:input.observedAt,values,correctionOfId:input.correctionOfId,reason:input.reason?.trim()}});
 await tx.activityLog.create({data:{userId:actor.id,action:'CREATE',entityType:'VitalObservation',entityId:row.id,metadata:{encounterId:input.encounterId,correctionOfId:input.correctionOfId??null}}});return row;
 });
}
export async function reviewVitals(id:string,note:string,actor:SessionUser){
 if(!can(actor,'vitals.review')||!can(actor,'vitals.view'))throw new Error('Vital review permission required.');z.string().trim().min(3).max(1000).parse(note);
 return prisma.$transaction(async tx=>{
 await tx.vitalObservation.findFirstOrThrow({where:{id,encounter:vitalScope(actor)}});
 const review=await tx.vitalReview.create({data:{observationId:id,reviewerId:actor.id,note:note.trim()}});
 await tx.activityLog.create({data:{userId:actor.id,action:'REVIEW',entityType:'VitalObservation',entityId:id,metadata:{reviewId:review.id}}});return review;
 });
}
