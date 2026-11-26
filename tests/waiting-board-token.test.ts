import 'dotenv/config';
import assert from 'node:assert/strict';
import {boardToken,boardBranch} from '../src/server/waiting-board/token';
process.env.HOSPITAL_WAITING_BOARD_KEY='synthetic-display-test-key-not-for-deployment';
const a=boardToken('branch-main'),b=boardToken('branch-secondary');assert.notEqual(a,b);assert.equal(boardBranch(a),'branch-main');assert.equal(boardBranch(b),'branch-secondary');assert.throws(()=>boardBranch(a+'changed'));assert.throws(()=>boardBranch('branch-main'));process.env.HOSPITAL_WAITING_BOARD_KEY='rotated-synthetic-display-key-not-for-deployment';assert.throws(()=>boardBranch(a));console.log('Waiting board token passed: branch identity, tamper rejection and rotation revocation.');
