// Day math steps by calendar date (setDate), never by adding ms, so DST days stay correct.
export const addDays = (d, n) => {
    const x = new Date(d);
    x.setDate(x.getDate() + n);
    return x;
};

export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Weeks start on Sunday, like Apple Calendar's default.
export const startOfWeek = (d) => addDays(startOfDay(d), -d.getDay());

export const sameDay = (a, b) => a.toDateString() === b.toDateString();

// Zero-length events still count for the day they start on.
export const overlaps = (e, from, to) => e.start < to && (e.end > from || e.start >= from);

// Always 6 weeks so the grid height never jumps between months.
export const monthGrid = (cursor) => {
    const start = startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
};

export const viewDays = (view, cursor) => {
    if (view === "month") return monthGrid(cursor);
    if (view === "week") {
        const start = startOfWeek(cursor);
        return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
    return [startOfDay(cursor)];
};

// End is exclusive: midnight after the last visible day.
export const visibleRange = (view, cursor) => {
    const days = viewDays(view, cursor);
    return { start: days[0], end: addDays(days.at(-1), 1) };
};

export const step = (view, cursor, dir) => {
    if (view === "month") return new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
    return addDays(cursor, view === "week" ? 7 * dir : dir);
};

// Minutes since the day's midnight by wall clock; the next midnight maps to 1440.
export const minutesInDay = (d, day) =>
    d >= addDays(day, 1) ? 1440 : d.getHours() * 60 + d.getMinutes();

// Assigns overlapping segments to side-by-side columns. Returns {...seg, col, cols}.
export function layoutDay(segs) {
    const sorted = [...segs].sort((a, b) => a.start - b.start || b.end - a.end);
    const out = [];
    let cluster = [];
    let colEnds = [];
    let clusterEnd = -Infinity;
    const flush = () => {
        cluster.forEach((s) => (s.cols = colEnds.length));
        cluster = [];
        colEnds = [];
        clusterEnd = -Infinity;
    };
    for (const s of sorted) {
        if (s.start >= clusterEnd) flush();
        let col = colEnds.findIndex((end) => end <= s.start);
        if (col === -1) {
            col = colEnds.length;
            colEnds.push(s.end);
        } else {
            colEnds[col] = s.end;
        }
        const item = { ...s, col };
        cluster.push(item);
        out.push(item);
        clusterEnd = Math.max(clusterEnd, s.end);
    }
    flush();
    return out;
}

// "YYYY-MM-DDTHH:mm" in browser local time, the value format <input type="datetime-local"> uses.
const pad = (n) => String(n).padStart(2, "0");
export const toLocalInput = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Stable color per event from its first tag; untagged events use Apple blue.
export const eventHue = (e) => (e.tags?.[0] ? (e.tags[0].id * 47) % 360 : 211);
