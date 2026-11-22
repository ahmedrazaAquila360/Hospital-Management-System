import assert from "node:assert/strict";
import { calendarDay, shiftDay, shiftMonth, validDay } from "../src/lib/report-calendar";
import { resolveRange } from "../src/lib/reports";

assert.equal(calendarDay("Asia/Karachi", new Date("2026-12-31T20:00:00Z")), "2027-01-01");
assert.equal(calendarDay("America/Los_Angeles", new Date("2027-01-01T01:00:00Z")), "2026-12-31");
assert.equal(shiftDay("2024-03-01", -1), "2024-02-29");
assert.equal(shiftMonth("2027-01-31", -1), "2026-12-01");
assert.equal(validDay("2026-02-30"), false);
assert.equal(validDay("garbage"), false);
const now = new Date("2026-12-31T20:00:00Z");
assert.equal(resolveRange("month", undefined, undefined, "Asia/Karachi", now).first, "2027-01-01");
assert.equal(resolveRange("year", undefined, undefined, "America/Los_Angeles", now).first, "2026-01-01");
const custom = resolveRange("custom", "2024-02-29", "2024-03-01", "Asia/Karachi", now);
assert.equal(custom.start.toISOString(), "2024-02-29T00:00:00.000Z");
assert.equal(custom.end.toISOString(), "2024-03-02T00:00:00.000Z");
assert.equal(resolveRange("custom", "2026-02-30", "2026-03-01", "Asia/Karachi", now).first, "2027-01-01");
assert.equal(resolveRange("custom", "2026-03-02", "2026-03-01", "Asia/Karachi", now).first, "2027-01-01");
console.log("Calendar tests passed: timezone rollover, leap dates, custom ranges and invalid inputs.");
