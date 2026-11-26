'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth/guard';
import {changeAttendance} from './service';
export async function saveAttendance(form:FormData){const action=z.enum(['IN','OUT','PLAN','CORRECT']).parse(form.get('action'));await changeAttendance({action,id:String(form.get('id')||'')||undefined,userId:String(form.get('userId')||'')||undefined,start:form.get('start')?new Date(String(form.get('start'))):undefined,end:form.get('end')?new Date(String(form.get('end'))):undefined,reason:String(form.get('reason')||'')||undefined},await requireUser());revalidatePath('/attendance');}
