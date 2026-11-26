'use server';
import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth/guard';
import {recordToothCondition} from './service';
export type ToothUpdateResult={success:boolean;error?:string};
export async function updateToothConditionAction(input:{toothId:string;condition:string;notes?:string;surface?:string}):Promise<ToothUpdateResult>{
 const result=await recordToothCondition(input,await requireUser());
 if(result.success){revalidatePath('/dental-chart');revalidatePath(`/patients/${result.patientId}`);}
 return {success:result.success,...(result.error?{error:result.error}:{})};
}
