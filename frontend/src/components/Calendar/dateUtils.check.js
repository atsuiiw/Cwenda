// Self-check: TZ=America/New_York node src/components/Calendar/dateUtils.check.js
import assert from "node:assert/strict";
import { addDays, monthGrid, visibleRange, step, layoutDay, minutesInDay, overlaps, toLocalInput } from "./dateUtils.js";

// datetime-local round trip is exact, including on the DST change day.
for (const d of [new Date(2026, 9, 30, 9, 5), new Date(2026, 10, 1, 13, 45), new Date(2026, 0, 1, 0, 0)]) {
    assert.equal(new Date(toLocalInput(d)).getTime(), d.getTime());
}
assert.equal(toLocalInput(new Date(2026, 0, 2, 3, 4)), "2026-01-02T03:04");

// Oct 1 2026 is a Thursday, so the grid starts Sunday Sep 27 and ends Sat Nov 7.
const grid = monthGrid(new Date(2026, 9, 15));
assert.equal(grid.length, 42);
assert.equal(grid[0].toDateString(), new Date(2026, 8, 27).toDateString());
assert.equal(grid[41].toDateString(), new Date(2026, 10, 7).toDateString());

// US DST ends Nov 1 2026: stepping a day keeps midnight.
const afterDst = addDays(new Date(2026, 10, 1), 1);
assert.equal(afterDst.getHours(), 0);
assert.equal(afterDst.getDate(), 2);

const week = visibleRange("week", new Date(2026, 9, 30));
assert.equal(week.start.toDateString(), new Date(2026, 9, 25).toDateString());
assert.equal(week.end.toDateString(), new Date(2026, 10, 1).toDateString());

// Stepping from Jan 31 lands in February, not March.
assert.equal(step("month", new Date(2026, 0, 31), 1).getMonth(), 1);

const day = new Date(2026, 9, 30);
assert.equal(minutesInDay(new Date(2026, 9, 30, 9, 30), day), 570);
assert.equal(minutesInDay(new Date(2026, 9, 31), day), 1440);

const at = (h) => new Date(2026, 9, 30, h);
const zero = { start: at(9), end: at(9) };
assert.ok(overlaps(zero, day, addDays(day, 1)));

// A and B overlap (2 columns); C is alone after them (1 column, reuses col 0).
const laid = layoutDay([
    { id: "A", start: at(9), end: at(11) },
    { id: "B", start: at(10), end: at(12) },
    { id: "C", start: at(13), end: at(14) },
]);
const byId = Object.fromEntries(laid.map((s) => [s.id, s]));
assert.deepEqual([byId.A.col, byId.A.cols], [0, 2]);
assert.deepEqual([byId.B.col, byId.B.cols], [1, 2]);
assert.deepEqual([byId.C.col, byId.C.cols], [0, 1]);

console.log("dateUtils ok");
