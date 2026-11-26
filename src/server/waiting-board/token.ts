import 'server-only';
import {createHmac,timingSafeEqual} from 'node:crypto';
function secret(){const value=process.env.HOSPITAL_WAITING_BOARD_KEY;if(!value||value.length<32)throw new Error('Configure HOSPITAL_WAITING_BOARD_KEY with at least 32 characters.');return value;}
export function boardToken(branchId:string){const body=Buffer.from(branchId).toString('base64url');return body+'.'+createHmac('sha256',secret()).update(body).digest('base64url');}
export function boardBranch(token:string){
 if(token.length>512)throw new Error('Invalid display link.');
 const [body,signature,...extra]=token.split('.');if(!body||!signature||extra.length)throw new Error('Invalid display link.');
 const expected=createHmac('sha256',secret()).update(body).digest();const actual=Buffer.from(signature,'base64url');
 if(actual.length!==expected.length||!timingSafeEqual(actual,expected))throw new Error('Invalid display link.');
 const branch=Buffer.from(body,'base64url').toString();if(!branch||branch.length>128)throw new Error('Invalid display link.');return branch;
}
