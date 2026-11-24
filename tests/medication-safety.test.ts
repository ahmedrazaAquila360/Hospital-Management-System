import assert from "node:assert/strict";
import {medicationReview, resolveMedicine} from "../src/server/medications/safety";
const resolve = async(name: string)=>name==='unknown'?null:{name,rxcui:'723',ingredients:[{rxcui:'723',name:'amoxicillin'}]};
async function main() {
 const review=await medicationReview(['amoxicillin','brand','unknown'],'amoxicillin: rash',resolve);
 assert(review.result.warnings.some(w=>w.includes('duplicate therapy')));
 assert(review.result.warnings.some(w=>w.includes('recorded allergy')));
 assert(review.result.warnings.some(w=>w.includes('could not be verified')));
 const outage=await medicationReview(['medicine'],null,async()=>{throw Error('offline')});
 assert(outage.result.warnings[0].includes('could not be verified'));
 assert.notEqual(review.fingerprint,(await medicationReview(['amoxicillin'],'different',resolve)).fingerprint);
 if(process.env.RUN_MEDICATION_LIVE_TEST==='1') {
  const identity=await resolveMedicine('amoxicillin');assert.equal(identity?.rxcui,'723');assert(identity?.ingredients.some(i=>i.name==='amoxicillin'));
  console.log('Live NLM exact identity and ingredient lookup passed.');
 }
 console.log('Medication duplicate, allergy-text, unknown-name and outage checks passed.');
}
main().catch(e=>{console.error(e);process.exitCode=1});
