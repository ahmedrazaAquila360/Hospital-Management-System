import {NextResponse} from 'next/server';
import {jobAuthorized} from '@/server/jobs/auth';
import {basePrisma} from '@/lib/prisma-base';
export async function GET(request:Request){if(!jobAuthorized(request))return NextResponse.json({error:'Unauthorized'},{status:401});try{await basePrisma.$queryRaw`SELECT 1`;return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}})}catch{return NextResponse.json({ok:false},{status:503,headers:{'Cache-Control':'no-store'}})}}
