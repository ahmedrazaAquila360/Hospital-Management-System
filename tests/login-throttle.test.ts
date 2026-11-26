import "dotenv/config";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {loginIsThrottled,recordFailedLogin,clearFailedLogins} from "../src/server/auth/login-throttle";

async function main(){
 assert.equal(process.env.RUN_HOSPITAL_TRANSACTION_TESTS,"1");
 const email=`throttle-${randomUUID()}@example.invalid`;
 try{
  assert.equal(await loginIsThrottled(email),false);
  await Promise.all(Array.from({length:5},()=>recordFailedLogin(email)));
  assert.equal(await loginIsThrottled(email),true);
  assert.equal(await loginIsThrottled(email.toUpperCase()),true);
  await clearFailedLogins(email);
  assert.equal(await loginIsThrottled(email),false);
  console.log("Login throttle passed: concurrent failures lock, normalized key and successful reset.");
 }finally{await clearFailedLogins(email)}
}
main();
