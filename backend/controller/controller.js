// Shared logic used by more than one route. SQL stays in the router; this
// module holds the parts that were duplicated across routes.

const POSITIVE_INT = /^\d+$/;

/**
 * Validate and de-duplicate a list of tag ids.
 *
 * `coerce` exists because the callers differ: query-string values always
 * arrive as strings and need parsing, while JSON body values already carry a
 * type and must be checked without conversion, so a body of ["1"] is rejected
 * where ?tag=1 is accepted.
 *
 * @returns {{ ids: number[], error: string|null }}
 */
export function parseTagIds(raw, { coerce = false, message = "Tags must be positive integer tag ids" } = {}) {
    if (raw === undefined || raw === null) {
        return { ids: [], error: null };
    }
    if (!Array.isArray(raw)) {
        raw = [raw];
    }
    if (raw.length === 0) {
        return { ids: [], error: null };
    }

    const ids = [];
    for (const value of raw) {
        let id = value;
        if (coerce) {
            if (typeof value !== 'string' || !POSITIVE_INT.test(value.trim())) {
                return { ids: [], error: message };
            }
            id = Number(value.trim());
        }
        if (typeof id !== 'number' || !Number.isInteger(id) || id < 1) {
            return { ids: [], error: message };
        }
        ids.push(id);
    }

    return { ids: [...new Set(ids)], error: null };
}

/**
 * Parse the `match` query parameter that selects tag-filter semantics.
 *
 * Defaults to "all" so callers that omit `match` keep the every-tag-required
 * behaviour. Repeated keys arrive as an array from Express and are rejected.
 *
 * @returns {{ requireAll: boolean|null, error: string|null }}
 */
export function parseMatchMode(raw) {
    if (raw === undefined) {
        return { requireAll: true, error: null };
    }
    if (Array.isArray(raw)) {
        return { requireAll: null, error: "match must be 'all' or 'any'" };
    }
    const mode = String(raw).trim().toLowerCase();
    if (mode === 'all') {
        return { requireAll: true, error: null };
    }
    if (mode === 'any') {
        return { requireAll: false, error: null };
    }
    return { requireAll: null, error: "match must be 'all' or 'any'" };
}

/**
 * Translate a Postgres error into a client-facing response.
 *
 * @returns {{ status: number, body: object }|null} null when unrecognised, so
 * the caller can fall through to its own 500 handling.
 */
export function mapPgError(err) {
    if (err.code === '23503') {
        return { status: 400, body: { message: "Unknown tag id", detail: err.detail } };
    }
    if (err.code === '23505') {
        const message = err.constraint === 'tag_name_key' ? "Tag name already exists" : "Duplicate key";
        return { status: 409, body: { message, detail: err.detail } };
    }
    if (err.code === '22007') {
        return { status: 400, body: { message: "Invalid timestamp format", detail: err.detail } };
    }
    return null;
}

/**
 * Make an event's junction rows match `tagIds` exactly, then report unknown
 * ids instead of writing anything.
 *
 * Runs on the caller's client so it joins the caller's transaction: a rejection
 * here leaves the enclosing transaction to be rolled back by the caller.
 *
 * @returns {{ error: object|null }} error is a ready-to-send response payload.
 */
export async function syncEventTags(client, eventId, tagIds) {
    if (tagIds.length > 0) {
        const known = await client.query(
            `SELECT id FROM "tag" WHERE id = ANY($1::int[]);`,
            [tagIds]
        );
        const found = new Set(known.rows.map(r => r.id));
        const missing = tagIds.filter(id => !found.has(id));
        if (missing.length > 0) {
            return { error: { message: "Unknown tag ids", missing } };
        }
    }

    // Set-based sync: drop links that are no longer wanted, then add the wanted
    // ones. No diffing in JS, and converges in either direction.
    await client.query(
        `DELETE FROM "junction"
         WHERE event_id = $1 AND NOT (tag_id = ANY($2::int[]));`,
        [eventId, tagIds]
    );
    await client.query(
        `INSERT INTO "junction" (event_id, tag_id)
         SELECT $1, unnest($2::int[])
         ON CONFLICT (event_id, tag_id) DO NOTHING;`,
        [eventId, tagIds]
    );

    return { error: null };
}

// A time followed by Z or ±HH[:MM], e.g. 2026-10-30T09:00:00Z or 2026-10-30 16:00+07.
const HAS_OFFSET = /\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * Reject timestamps without a UTC offset. Postgres would read them in the DB
 * session's time zone (not the event's `timezone` column) and silently shift
 * them. Absent, null and "" are left to each route's own rules.
 *
 * @returns {string|null} error message, or null when both fields are fine.
 */
export function checkTimestampOffsets(data) {
    for (const field of ['start_time', 'end_time']) {
        const value = data[field];
        if (value === undefined || value === null || value === '') continue;
        if (typeof value !== 'string' || !HAS_OFFSET.test(value.trim())) {
            return `${field} must include a UTC offset, e.g. 2026-10-30T09:00:00Z`;
        }
    }
    return null;
}

/**
 * Validate a tag name from a JSON body (shared by postTag and updateTag).
 *
 * @returns {{ name: string|null, error: string|null }}
 */
export function parseTagName(raw) {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name) {
        return { name: null, error: "Tag name is required" };
    }
    if (name.length > 255) {
        return { name: null, error: "Tag name must be at most 255 characters" };
    }
    return { name, error: null };
}
