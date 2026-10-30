import { Router } from "express";
import pool from '../db/db.js';
import { parseTagIds, parseMatchMode, mapPgError, syncEventTags, checkTimestampOffsets, parseTagName } from '../controller/controller.js';
const router = Router();


router.get('/getEvent', async (req,res) => {
    try {
        let { start_time, end_time } = req.query;

        // Default to the current month (server local time): 1st 00:00 to last day 23:59:59.999.
        const now = new Date();
        if(start_time && !end_time){
            end_time = start_time;
        }
        if (!start_time) {
            start_time = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        }
        if (!end_time) {
            end_time = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
        }

        // Optional tag filter. Query params are always strings, so coerce.
        const { ids: tagIds, error: tagError } = parseTagIds(req.query.tag, {
            coerce: true,
            message: "Tags must be positive integer tag ids"
        });
        if (tagError) {
            return res.status(400).json({ message: tagError });
        }

        const { requireAll, error: matchError } = parseMatchMode(req.query.match);
        if (matchError) {
            return res.status(400).json({ message: matchError });
        }

        // FILTER inside HAVING counts only the requested tags without dropping
        // the event's other tag rows, so the aggregated `tags` output stays full.
        let having = '';
        if (tagIds.length > 0) {
            having = requireAll
                ? `HAVING count(DISTINCT t.id) FILTER (WHERE t.id = ANY($3::int[])) = cardinality($3::int[])`
                : `HAVING count(DISTINCT t.id) FILTER (WHERE t.id = ANY($3::int[])) >= 1`;
        }

        const sql_query = `
            SELECT 
                e.id AS event_id,
                e.name AS event_name,
                e.description,
                e.associate_links,
                e.start_time,
                e.end_time,
                COALESCE(
                    json_agg(
                        json_build_object('id', t.id, 'name', t.name)
                        ORDER BY t.id
                    ) FILTER (WHERE t.id IS NOT NULL),
                    '[]'
                ) AS tags
            FROM "event" e
            LEFT JOIN junction j ON e.id = j.event_id
            LEFT JOIN "tag" t ON j.tag_id = t.id
            WHERE e.start_time <= $1 AND e.end_time >= $2
            GROUP BY e.id
            ${having}
            ORDER BY e.id;
        `;

        const value = tagIds.length > 0 ? [end_time, start_time, tagIds] : [end_time, start_time];
        const result = await pool.query(sql_query, value);
        res.status(200).json(result.rows);
    } catch(err){
        res.status(500).json({ message : err.message })
    }
});

router.get('/getEvent/:id', async (req,res) => {
    try {
        const eventId = Number(String(req.params.id).trim());
        if (!Number.isInteger(eventId) || eventId < 1) {
            return res.status(400).json({ message: "Event id must be a positive integer" });
        }

        const eventResult = await pool.query(
            `SELECT id, name, description, associate_links, start_time, end_time, timezone
             FROM "event"
             WHERE id = $1;`,
            [eventId]
        );
        if (eventResult.rowCount === 0) {
            return res.status(404).json({ message: "Event not found", id: eventId });
        }

        const tagsResult = await pool.query(
            `SELECT t.id, t.name
             FROM "junction" j
             JOIN "tag" t ON t.id = j.tag_id
             WHERE j.event_id = $1
             ORDER BY t.id;`,
            [eventId]
        );

        res.status(200).json({ ...eventResult.rows[0], tags: tagsResult.rows });
    } catch(err){
        res.status(500).json({ message : err.message })
    }
});

router.get('/getAllTags', async (req,res) => {
    try{
        const sql_query = `
            SELECT id, name
            FROM "tag"
            ORDER BY id;
        `;

        const result = await pool.query(sql_query);
        res.status(200).json(result.rows);
    } catch(err){
        res.status(500).json({ message : err.message });
    }
});

router.get('/getTagUsage', async (req,res) => {
    try{
        // LEFT JOIN so tags with no linked events report 0 instead of dropping out.
        // count() is bigint, which pg returns as a string, so cast to int.
        const sql_query = `
            SELECT t.id, t.name, count(j.event_id)::int AS event_count
            FROM "tag" t
            LEFT JOIN "junction" j ON j.tag_id = t.id
            GROUP BY t.id
            ORDER BY t.id;
        `;

        const result = await pool.query(sql_query);
        res.status(200).json(result.rows);
    } catch(err){
        res.status(500).json({ message : err.message });
    }
});

router.get('/getEventByTag', async (req,res) => {
    try{
        const rawTags = req.query.tag; 

        if (rawTags === undefined) {
            return res.status(400).send("No tags provided");
        }

        // Query params are always strings, so coerce before validating.
        const { ids: tagIds, error } = parseTagIds(rawTags, {
            coerce: true,
            message: "Tags must be positive integer tag ids"
        });
        if (error) {
            return res.status(400).json({ message: error });
        }
        if (tagIds.length === 0) {
            return res.status(400).send("No tags provided");
        }

        const { requireAll, error: matchError } = parseMatchMode(req.query.match);
        if (matchError) {
            return res.status(400).json({ message: matchError });
        }

        // GROUP BY already de-dupes events, so "any" is just "all" without HAVING.
        const having = requireAll
            ? 'HAVING count(DISTINCT j.tag_id) = cardinality($1::int[])'
            : '';

        const sql_query = `
            SELECT e.id, e.name, e.description
            FROM "event" e
            JOIN "junction" j ON e.id = j.event_id
            WHERE j.tag_id = ANY($1::int[])
            GROUP BY e.id
            ${having}
            ORDER BY e.id;
        `;
        
        const result = await pool.query(sql_query, [tagIds]);
        res.status(200).json(result.rows);
    } catch (err) {
        res.status(500).json({ message : err.message });
    }
})

router.post('/postEvent', async (req, res) => {
    const client = await pool.connect();
    try {
        const data = req.body;
        const tagsProvided = data.tags !== undefined;
        if (tagsProvided && !Array.isArray(data.tags)) {
            return res.status(400).json({ message: "tags must be an array of tag ids" });
        }
        const { ids: tagIds, error: tagError } = parseTagIds(data.tags, {
            message: "tags must contain positive integer tag ids"
        });
        if (tagError) {
            return res.status(400).json({ message: tagError });
        }

        const offsetError = checkTimestampOffsets(data);
        if (offsetError) {
            return res.status(400).json({ message: offsetError });
        }

        // Same rule as updateEvent; equal times are allowed (zero-length events).
        if (data.start_time && data.end_time &&
            new Date(data.end_time) < new Date(data.start_time)) {
            return res.status(400).json({ message: "end_time cannot be before start_time" });
        }

        await client.query('BEGIN');

        const sql_query = `
            INSERT INTO "event"(name, description, associate_links, start_time, end_time, timezone)
            VALUES($1, $2, $3, $4, $5, $6)
            RETURNING id;
        `;
        const values = [
            data.name, 
            data.description, 
            JSON.stringify(data.associate_links ?? {}), // Safely formats object for PostgreSQL JSONB
            data.start_time,
            // Fail-safe: a missing end_time makes a zero-length event at start_time.
            data.end_time || data.start_time,
            data.timezone
        ];

        const result = await client.query(sql_query, values);
        const eventId = result.rows[0].id;

        if (tagsProvided) {
            const { error } = await syncEventTags(client, eventId, tagIds);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json(error);
            }
        }

        await client.query('COMMIT');
        res.status(201).json({ ...result.rows[0], tags: tagIds });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const mapped = mapPgError(err);
        if (mapped) {
            return res.status(mapped.status).json(mapped.body);
        }
        console.error("ERROR CAUGHT:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.put('/updateEvent/:id', async (req, res) => {
    const client = await pool.connect();
    try {
        const eventId = Number(String(req.params.id).trim());
        if (!Number.isInteger(eventId) || eventId < 1) {
            return res.status(400).json({ message: "Event id must be a positive integer" });
        }

        const data = req.body ?? {};

        // Whitelist of updatable columns. Building SET from these keys means
        // request data can never reach the SQL string, only bind parameters.
        const UPDATABLE = {
            name: 'name',
            description: 'description',
            associate_links: 'associate_links',
            start_time: 'start_time',
            end_time: 'end_time',
            timezone: 'timezone'
        };
        const has = key => Object.prototype.hasOwnProperty.call(data, key);
        const provided = Object.keys(UPDATABLE).filter(has);
        // hasOwnProperty, not a truthiness test: an absent "tags" key means
        // leave links alone, while an explicit [] means remove them all.
        const tagsProvided = has('tags');

        if (provided.length === 0 && !tagsProvided) {
            return res.status(400).json({ message: "No updatable fields provided" });
        }

        const offsetError = checkTimestampOffsets(data);
        if (offsetError) {
            return res.status(400).json({ message: offsetError });
        }

        await client.query('BEGIN');

        // FOR UPDATE so a concurrent update cannot merge against a stale row.
        const current = await client.query(
            `SELECT * FROM "event" WHERE id = $1 FOR UPDATE;`,
            [eventId]
        );
        if (current.rowCount === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ message: "Event not found", id: eventId });
        }
        const existing = current.rows[0];

        // Omitting a timestamp keeps the stored one; only an explicit null is
        // rejected, since that would silently erase a value.
        for (const field of ['start_time', 'end_time']) {
            if (has(field) && data[field] === null) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `${field} cannot be null` });
            }
        }

        // Order must be checked against the merged row, not just the body:
        // updating one bound can contradict the other's stored value.
        const merged = { ...existing };
        for (const field of provided) merged[field] = data[field];
        if (merged.start_time && merged.end_time &&
            // Equal times are allowed: postEvent creates zero-length events when end_time is missing.
            new Date(merged.end_time) < new Date(merged.start_time)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: "end_time cannot be before start_time" });
        }

        // updated stays as the pre-update row when only tags were supplied.
        let updated = existing;
        if (provided.length > 0) {
            const sets = [];
            const values = [];
            for (const field of provided) {
                values.push(field === 'associate_links'
                    ? JSON.stringify(data[field] ?? {})
                    : data[field]);
                sets.push(`${UPDATABLE[field]} = $${values.length}`);
            }

            const result = await client.query(
                `UPDATE "event" SET ${sets.join(', ')} WHERE id = $${values.length + 1}
                 RETURNING *;`,
                [...values, eventId]
            );
            updated = result.rows[0];
        }

        let tagIds = null;
        if (tagsProvided) {
            if (!Array.isArray(data.tags)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: "tags must be an array of tag ids" });
            }
            const parsed = parseTagIds(data.tags, {
                message: "tags must contain positive integer tag ids"
            });
            if (parsed.error) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: parsed.error });
            }
            tagIds = parsed.ids;

            const { error } = await syncEventTags(client, eventId, tagIds);
            if (error) {
                await client.query('ROLLBACK');
                return res.status(400).json(error);
            }
        }

        const links = await client.query(
            `SELECT t.id, t.name
             FROM "junction" j
             JOIN "tag" t ON t.id = j.tag_id
             WHERE j.event_id = $1
             ORDER BY t.id;`,
            [eventId]
        );

        await client.query('COMMIT');
        res.status(200).json({ ...updated, tags: links.rows });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        const mapped = mapPgError(err);
        if (mapped) {
            return res.status(mapped.status).json(mapped.body);
        }
        console.error("ERROR CAUGHT:", err);
        res.status(500).json({ message: err.message });
    } finally {
        client.release();
    }
});

router.post('/postTag', async (req, res) => {
    try {
        const { name, error: nameError } = parseTagName(req.body?.name);
        if (nameError) {
            return res.status(400).json({ message: nameError });
        }

        // tag_name_key rejects duplicates; mapPgError turns that into a 409.
        const result = await pool.query(
            `INSERT INTO "tag"(name) VALUES ($1) RETURNING id, name;`,
            [name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        const mapped = mapPgError(err);
        if (mapped) {
            return res.status(mapped.status).json(mapped.body);
        }
        res.status(500).json({ message: err.message });
    }
});

router.put('/updateTag/:id', async (req, res) => {
    try {
        const tagId = Number(String(req.params.id).trim());
        if (!Number.isInteger(tagId) || tagId < 1) {
            return res.status(400).json({ message: "Tag id must be a positive integer" });
        }
        const { name, error: nameError } = parseTagName(req.body?.name);
        if (nameError) {
            return res.status(400).json({ message: nameError });
        }

        const result = await pool.query(
            `UPDATE "tag" SET name = $1 WHERE id = $2 RETURNING id, name;`,
            [name, tagId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Tag not found", id: tagId });
        }
        res.status(200).json(result.rows[0]);
    } catch (err) {
        const mapped = mapPgError(err);
        if (mapped) {
            return res.status(mapped.status).json(mapped.body);
        }
        res.status(500).json({ message: err.message });
    }
});

// fk_tag is ON DELETE CASCADE: this unlinks the tag from every event, events stay.
router.delete('/deleteTag/:id', async (req, res) => {
    try {
        const tagId = Number(String(req.params.id).trim());
        if (!Number.isInteger(tagId) || tagId < 1) {
            return res.status(400).json({ message: "Tag id must be a positive integer" });
        }

        const result = await pool.query(
            `DELETE FROM "tag" WHERE id = $1 RETURNING id, name;`,
            [tagId]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Tag not found", id: tagId });
        }
        res.status(200).json({ deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.delete('/deleteEvent/:id', async (req, res) => {
    try {
        const eventId = Number(String(req.params.id).trim());
        if (!Number.isInteger(eventId) || eventId < 1) {
            return res.status(400).json({ message: "Event id must be a positive integer" });
        }

        const sql_query = `
            DELETE FROM "event"
            WHERE id = $1
            RETURNING id, name;
        `;

        const result = await pool.query(sql_query, [eventId]);
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Event not found", id: eventId });
        }

        res.status(200).json({ deleted: result.rows[0] });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});


export default router;