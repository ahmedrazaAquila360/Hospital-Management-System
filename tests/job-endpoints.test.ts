import 'dotenv/config';
import assert from 'node:assert/strict';
import {GET} from '../src/app/api/health/route';
import {POST} from '../src/app/api/jobs/follow-up-reminders/route';
import {basePrisma} from '../src/lib/prisma-base';
async function main(){assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,'1');process.env.HOSPITAL_JOB_TOKEN='synthetic-job-test-token-not-for-production';const request=()=>new Request('http://localhost/api/jobs/follow-up-reminders',{method:'POST',headers:{authorization:'Bearer '+process.env.HOSPITAL_JOB_TOKEN}});assert.equal((await GET(new Request('http://localhost/api/health'))).status,401);assert.equal((await POST(new Request('http://localhost/api/jobs/follow-up-reminders',{method:'POST'}))).status,401);assert.equal((await GET(request())).status,200);assert.equal((await POST(request())).status,200);assert.equal((await POST(request())).status,200);console.log('Job endpoints passed: token required, database health and repeatable branch reminder execution.');}
main().finally(()=>basePrisma.$disconnect());
