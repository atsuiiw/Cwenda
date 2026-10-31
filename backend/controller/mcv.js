// MyCourseVille import helpers: run the `mcv` CLI and map its assignments to
// event fields. No SQL here; the route in router.js does the writes.
import { execFile } from 'node:child_process';

const MONTHS = 'janfebmaraprmayjunjulaugsepoctnovdec';
// "Nov 5 2026 Due on 05 November 2026 at 09:00" -> day, month, year, [hour, minute]
const DUE_ON = /Due on (\d{1,2}) ([A-Za-z]{3,9}) (\d{4})(?: at (\d{1,2}):(\d{2}))?/i;
// Fallback: the leading "Nov 5 2026" plus the separate duetime "09:00".
const LEADING = /^([A-Za-z]{3,9}) (\d{1,2}),? (\d{4})/;
const HH_MM = /^(\d{1,2}):(\d{2})$/;
const MCV_HOST = 'https://www.mycourseville.com/';

// MyCourseVille times are Bangkok time, which is UTC+7 with no daylight saving.
function bangkokIso(year, month, day, hour, minute) {
    const monthIndex = MONTHS.indexOf(month.slice(0, 3).toLowerCase()) / 3;
    if (!Number.isInteger(monthIndex) || monthIndex < 0) return null;
    if (hour > 23 || minute > 59) return null;
    const check = new Date(Date.UTC(year, monthIndex, day));
    if (check.getUTCDate() !== day || check.getUTCMonth() !== monthIndex) return null; // e.g. "31 February"
    return new Date(Date.UTC(year, monthIndex, day, hour - 7, minute)).toISOString();
}

/** @returns {string|null} ISO UTC timestamp of the deadline, or null when unreadable. */
export function parseDue(duedate, duetime) {
    if (typeof duedate !== 'string') return null;
    const time = typeof duetime === 'string' ? duetime.trim().match(HH_MM) : null;
    // A date with no time is due at the end of that day.
    const [hour, minute] = time ? [Number(time[1]), Number(time[2])] : [23, 59];

    const due = duedate.match(DUE_ON);
    if (due) {
        const [h, m] = due[4] ? [Number(due[4]), Number(due[5])] : [hour, minute];
        return bangkokIso(Number(due[3]), due[2], Number(due[1]), h, m);
    }
    const lead = duedate.trim().match(LEADING);
    if (lead) return bangkokIso(Number(lead[3]), lead[1], Number(lead[2]), hour, minute);
    return null;
}

/**
 * Map one `mcv` assignment to event fields.
 * @returns {{mcv_ref, name, due, course_no, links, submitted}|null} null when it can't be imported (no ref or due date).
 */
export function toEventFields(a) {
    if (typeof a?.ref !== 'string' || !a.ref.startsWith('mcv:assignment:')) return null;
    const due = parseDue(a.duedate, a.duetime);
    if (!due) return null;
    const url = typeof a.detail_url === 'string' && a.detail_url.startsWith(MCV_HOST) ? a.detail_url : null;
    const title = typeof a.title === 'string' ? a.title.trim() : '';
    return {
        mcv_ref: a.ref,
        name: (title || '(Untitled assignment)').slice(0, 255), // event.name is VARCHAR(255)
        due,
        // Tag names have no spaces (frontend rule), course numbers normally don't.
        course_no: a.course_no ? String(a.course_no).replace(/\s/g, '') || null : null,
        links: url ? [{ label: 'MyCourseVille', url }] : [],
        // mcv only includes submitted_at once the assignment has been handed in.
        submitted: a.submitted_at != null && a.submitted_at !== '',
    };
}

const firstLine = (text) => text.split('\n').map((l) => l.trim()).find(Boolean)?.slice(0, 300);

/**
 * Run `mcv --json assignments list` (current semester, submitted and not).
 * execFile with fixed args: no shell, request data never reaches the command.
 * @returns {Promise<{assignments: object[]}|{error: {status: number, body: object}}>}
 */
export function fetchAssignments() {
    // Read lazily: dotenv runs after ESM imports are evaluated.
    const bin = process.env.MCV_BIN || 'mcv';
    return new Promise((resolve) => {
        execFile(
            bin,
            ['--json', '--quiet', 'assignments', 'list'],
            { timeout: 120_000, maxBuffer: 20 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (err?.code === 'ENOENT') {
                    return resolve({ error: { status: 503, body: { message: "mcv is not installed or not on PATH. Install it, or set MCV_BIN in backend/.env to its full path." } } });
                }
                if (err?.killed) {
                    return resolve({ error: { status: 504, body: { message: "mcv took longer than 2 minutes and was stopped." } } });
                }
                if (err) {
                    // mcv prints a JSON error object on stderr, e.g. {"code":"not_authenticated","resource":"session",...}
                    let info = null;
                    try { info = JSON.parse(stderr); } catch { /* not JSON */ }
                    if (info?.resource === 'session') {
                        return resolve({ error: { status: 401, body: { message: `MyCourseVille login needed: ${info.message ?? 'run mcv auth login'}`, code: info.code } } });
                    }
                    return resolve({ error: { status: 502, body: { message: info?.message ?? firstLine(stderr) ?? 'mcv failed', code: info?.code } } });
                }
                let data;
                try { data = JSON.parse(stdout); } catch { data = null; }
                if (!Array.isArray(data)) {
                    return resolve({ error: { status: 502, body: { message: "Unexpected output from mcv (expected a JSON array)." } } });
                }
                resolve({ assignments: data });
            },
        );
    });
}
