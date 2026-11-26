import 'server-only';
import {timingSafeEqual} from 'node:crypto';
export function jobAuthorized(request:Request){const secret=process.env.HOSPITAL_JOB_TOKEN;if(!secret||secret.length<32)return false;const expected=Buffer.from('Bearer '+secret),actual=Buffer.from(request.headers.get('authorization')??'');return expected.length===actual.length&&timingSafeEqual(expected,actual);}
