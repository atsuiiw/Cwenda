// Self-check: node controller/mcv.check.js   (run from backend/)
import assert from 'node:assert/strict';
import { parseDue, toEventFields } from './mcv.js';

// Real mcv shape: 09:00 Bangkok = 02:00 UTC.
assert.equal(parseDue('Nov 5 2026 Due on 05 November 2026 at 09:00', '09:00'), '2026-11-05T02:00:00.000Z');
// Early morning Bangkok falls on the previous UTC day.
assert.equal(parseDue('Due on 01 December 2026 at 03:30', null), '2026-11-30T20:30:00.000Z');
// "Due on" without a time uses duetime, then end of day.
assert.equal(parseDue('Due on 05 November 2026', '17:15'), '2026-11-05T10:15:00.000Z');
assert.equal(parseDue('Due on 05 November 2026', null), '2026-11-05T16:59:00.000Z');
// Fallback to the leading date.
assert.equal(parseDue('Nov 5 2026', '09:00'), '2026-11-05T02:00:00.000Z');
// Unreadable or impossible values.
for (const bad of [null, '', 'soon', 'Due on 31 February 2026 at 09:00', 'Due on 05 Foo 2026 at 09:00', 'Due on 05 November 2026 at 25:00']) {
    assert.equal(parseDue(bad, '09:00'), null, String(bad));
}

const sample = {
    ref: 'mcv:assignment:81802:2084321',
    course_no: '2110204',
    title: ' ส่ง Link Certificate Module 12 ',
    detail_url: 'https://www.mycourseville.com/?q=courseville/worksheet/81802/2084321',
    duedate: 'Nov 5 2026 Due on 05 November 2026 at 09:00',
    duetime: '09:00',
};
assert.deepEqual(toEventFields(sample), {
    mcv_ref: 'mcv:assignment:81802:2084321',
    name: 'ส่ง Link Certificate Module 12',
    due: '2026-11-05T02:00:00.000Z',
    course_no: '2110204',
    links: [{ label: 'MyCourseVille', url: sample.detail_url }],
    submitted: false,
});
assert.equal(toEventFields({ ...sample, submitted_at: 'Submitted at 04 November 2026 at 22:10' }).submitted, true);
assert.equal(toEventFields({ ...sample, submitted_at: null }).submitted, false);
assert.equal(toEventFields({ ...sample, submitted_at: '' }).submitted, false);
assert.equal(toEventFields({ ...sample, duedate: null }), null);
assert.equal(toEventFields({ ...sample, ref: 'mcv:material:1:2' }), null);
assert.deepEqual(toEventFields({ ...sample, detail_url: 'javascript:alert(1)' }).links, []);
assert.equal(toEventFields({ ...sample, title: '' }).name, '(Untitled assignment)');
assert.equal(toEventFields({ ...sample, title: 'x'.repeat(300) }).name.length, 255);

console.log('mcv ok');
