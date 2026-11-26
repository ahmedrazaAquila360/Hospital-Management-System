'use server';
import {requireUser} from '@/lib/auth/guard';
import {revalidatePath} from 'next/cache';
import {recordVitals,reviewVitals,vitalNames} from './service';
export async function saveVitals(form:FormData){const actor=await requireUser();const values:Record<string,number>={};for(const key of Object.keys(vitalNames)){const raw=form.get(key);if(typeof raw==='string'&&raw.trim())values[key]=Number(raw)}await recordVitals({encounterId:String(form.get('encounterId')),observedAt:new Date(String(form.get('observedAt'))),values,correctionOfId:String(form.get('correctionOfId')||'')||undefined,reason:String(form.get('reason')||'')||undefined},actor);revalidatePath('/vitals');revalidatePath('/opd');}
export async function saveVitalReview(form:FormData){await reviewVitals(String(form.get('id')),String(form.get('note')),await requireUser());revalidatePath('/vitals');}
