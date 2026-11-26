import 'dotenv/config';
import {readdir,writeFile,appendFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
async function main(){
 if(process.env.RUN_HOSPITAL_TRANSACTION_TESTS!=='1'||process.env.NODE_ENV==='production')throw new Error('Opt in with RUN_HOSPITAL_TRANSACTION_TESTS=1 in a synthetic development environment.');
 const database=new URL(process.env.HOSPITAL_DATABASE_URL??'');
 if(database.pathname!=='/hospital_management_mvp')throw new Error('The test runner is limited to the dedicated hospital_management_mvp synthetic database.');
 const origin=new URL(process.env.HOSPITAL_TEST_ORIGIN??'http://localhost:3179');
 if(!['localhost','127.0.0.1','[::1]'].includes(origin.hostname)||!['http:','https:'].includes(origin.protocol))throw new Error('HTTP regression tests require a local synthetic application server.');
 const response=await fetch(origin.origin+'/api/waiting-board',{signal:AbortSignal.timeout(10000)});
 if(!response.ok)throw new Error('Start or restart the local application after Prisma generation before running HTTP tests.');
 const files=(await readdir('tests')).filter(name=>/\.test\.(ts|mts)$/.test(name)).sort();
 const log=path.resolve(process.env.HOSPITAL_TEST_LOG??'/tmp/hospital-v1-regression.log');await writeFile(log,'Synthetic hospital regression run\n',{mode:0o600});
 const nodeOptions=process.env.NODE_OPTIONS??'';
 const env={...process.env,HOSPITAL_TEST_ORIGIN:origin.origin,WAITING_BOARD_TEST_URL:origin.origin+'/api/waiting-board',NODE_OPTIONS:nodeOptions.includes('--conditions=react-server')?nodeOptions:nodeOptions+' --conditions=react-server'};
 const failed:string[]=[];
 for(const file of files){
  const result=await new Promise<{code:number;output:string}>((resolve,reject)=>{
   const child=spawn('pnpm',['exec','tsx',path.join('tests',file)],{env});let output='';
   child.stdout.on('data',chunk=>output+=chunk.toString());child.stderr.on('data',chunk=>output+=chunk.toString());child.on('error',reject);child.on('close',code=>resolve({code:code??1,output}));
  });
  await appendFile(log,'\n'+file+'\n'+result.output);console.log((result.code===0?'PASS ':'FAIL ')+file);if(result.code!==0)failed.push(file);
 }
 console.log(`${files.length-failed.length}/${files.length} test files passed. Log: ${log}`);
 if(failed.length){console.error('Failed: '+failed.join(', '));process.exitCode=1;}
}
main().catch(error=>{console.error(error instanceof Error?error.message:'Hospital regression runner failed.');process.exitCode=1;});
