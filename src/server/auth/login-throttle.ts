import "server-only";
import {createHmac} from "node:crypto";
import {basePrisma} from "@/lib/prisma-base";

const bounded=(value:string|undefined,fallback:number)=>{
 const parsed=Number(value);
 return Number.isInteger(parsed)&&parsed>=1&&parsed<=120?parsed:fallback;
};
const maxFailures=bounded(process.env.HOSPITAL_LOGIN_MAX_FAILURES,5);
const windowMs=bounded(process.env.HOSPITAL_LOGIN_WINDOW_MINUTES,15)*60000;
const lockMs=bounded(process.env.HOSPITAL_LOGIN_LOCK_MINUTES,15)*60000;

function throttleKey(email:string){
 const secret=process.env.HOSPITAL_AUTH_HMAC_KEY ?? (process.env.NODE_ENV!=="production"?process.env.HOSPITAL_DATABASE_URL:undefined);
 if(!secret||secret.length<16)throw new Error("Configure HOSPITAL_AUTH_HMAC_KEY for secure login throttling.");
 return createHmac("sha256",secret).update(email.trim().toLowerCase()).digest("hex");
}

export async function loginIsThrottled(email:string){
 const row=await basePrisma.loginThrottle.findUnique({where:{key:throttleKey(email)}});
 return Boolean(row?.lockedUntil&&row.lockedUntil>new Date());
}

export async function recordFailedLogin(email:string){
 const key=throttleKey(email);
 return basePrisma.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"login:"+key},0))::text`;
  const now=new Date();
  const row=await tx.loginThrottle.findUnique({where:{key}});
  const within=Boolean(row&&now.getTime()-row.windowStartedAt.getTime()<windowMs);
  const failures=within?(row?.failures??0)+1:1;
  const lockedUntil=failures>=maxFailures?new Date(now.getTime()+lockMs):null;
  await tx.loginThrottle.upsert({where:{key},create:{key,failures,windowStartedAt:now,lockedUntil},update:{failures,windowStartedAt:within?row!.windowStartedAt:now,lockedUntil}});
  return Boolean(lockedUntil);
 });
}

export async function clearFailedLogins(email:string){
 await basePrisma.loginThrottle.deleteMany({where:{key:throttleKey(email)}});
}
