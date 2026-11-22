import 'dotenv/config';
import assert from 'node:assert/strict';
import { calendarBounds } from '../src/server/reports/calendar';
import { prisma } from '../src/lib/prisma';
async function main() {
  const karachi = await calendarBounds('2026-11-22','2026-11-22','Asia/Karachi');
  assert.equal(karachi.start.toISOString(),'2026-11-21T19:00:00.000Z');
  assert.equal(karachi.end.toISOString(),'2026-11-22T19:00:00.000Z');
  const spring = await calendarBounds('2026-03-08','2026-03-08','America/New_York');
  const autumn = await calendarBounds('2026-11-01','2026-11-01','America/New_York');
  assert.equal((spring.end.getTime()-spring.start.getTime())/3600000,23);
  assert.equal((autumn.end.getTime()-autumn.start.getTime())/3600000,25);
  console.log('Database calendar boundaries passed: Karachi midnight and 23/25-hour DST days.');
}
main().finally(()=>prisma.$disconnect());
