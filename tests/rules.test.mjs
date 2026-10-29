// Run with: npm test (Node 22+, strips TypeScript types from rules.ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSellerIds, dayTimes, eventDates, freeSlots, freeTable, matchScore } from "../src/lib/rules.ts";

const ev = { startDate: "2026-11-20", days: 2, dayStart: "10:00", dayEnd: "11:00", slotMinutes: 30, tables: 1 };

test("Udyam must match the event state and IEC must be 10 characters", () => {
  assert.equal(checkSellerIds("UDYAM-AP-23-0012345", "0912004567", "AP", "Andhra Pradesh"), null);
  assert.match(checkSellerIds("UDYAM-KL-23-0012345", "0912004567", "AP", "Andhra Pradesh"), /UDYAM-AP/);
  assert.match(checkSellerIds("12345", "0912004567", "AP", "Andhra Pradesh"), /format/);
  assert.match(checkSellerIds("UDYAM-AP-23-0012345", "123", "AP", "Andhra Pradesh"), /IEC/);
});

test("dates and times come from the event settings", () => {
  assert.deepEqual(eventDates({ startDate: "2026-12-31", days: 2 }), ["2026-12-31", "2027-01-01"]);
  assert.deepEqual(dayTimes(ev), ["10:00", "10:30"]);
});

test("free slots skip busy participants and full tables", () => {
  const bookings = [{ fromId: "a", toId: "x", slotDate: "2026-11-20", slotTime: "10:00", table: 1 }];
  const forAB = freeSlots(ev, bookings, "a", "b").map((s) => `${s.date} ${s.time}`);
  assert.ok(!forAB.includes("2026-11-20 10:00"));
  assert.equal(forAB.length, 3);
  // only 1 table, so c and d can't use 10:00 either
  assert.ok(!freeSlots(ev, bookings, "c", "d").some((s) => s.date === "2026-11-20" && s.time === "10:00"));
  assert.equal(freeTable(2, bookings, { date: "2026-11-20", time: "10:00" }), 2);
  assert.equal(freeTable(1, bookings, { date: "2026-11-20", time: "10:00" }), null);
});

test("match score is shared sectors over the smaller list", () => {
  assert.equal(matchScore(["A", "B"], ["B"]), 100);
  assert.equal(matchScore(["A", "B"], ["B", "C"]), 50);
  assert.equal(matchScore(["A"], ["C"]), 0);
});
