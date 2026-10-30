# AGENTS.md

Express 5 + PostgreSQL REST API for managing calendar events and tags. All commands run from this `backend/` directory, not the repo root (the root `package.json` is an empty CommonJS stub; this package is ESM).

## Commands

- `npm run dev` — starts nodemon on `index.js` (listens on `PORT` from `.env`, currently 5200).
- `npm test` — intentionally fails (`exit 1`). There is no test suite; don't assume one exists.
- Apply schema: `psql -d cwenda -f db/schema.sql` (idempotent, structure only, no seed data).

## Layout

- `index.js` — entrypoint: loads dotenv, mounts the router at `/api`, adds a JSON error middleware, verifies DB connectivity with `SELECT 1` on listen.
- `db/db.js` — exports a single `pg` `Pool`; DB connection comes entirely from `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DB`).
- `router/router.js` — all routes and SQL. Endpoints: `GET /api/getEvent` (optional `?start_time=`/`?end_time=` ISO range, returns events overlapping it, defaulting to the current month in server local time; optional `?tag=` + `?match=`), `GET /api/getEvent/:id`, `GET /api/getAllTags` (distinct `{id, name}`, includes tags with no events), `GET /api/getTagUsage` (`{id, name, event_count}` per tag), `GET /api/getEventByTag` (requires `?tag=`; `?match=all|any`), `POST /api/postEvent`, `POST /api/postTag` (`{name}`, trimmed; duplicate name is `409`), `PUT /api/updateTag/:id` (`{name}`, same rules), `DELETE /api/deleteTag/:id` (unlinks it from every event via `fk_tag` cascade; events stay), `PUT /api/updateEvent/:id`, `DELETE /api/deleteEvent/:id`.
- `controller/controller.js` — shared helpers only (`parseTagIds`, `parseMatchMode`, `parseTagName`, `checkTimestampOffsets`, `mapPgError`, `syncEventTags`); no SQL lives here.
- `db/schema.sql` — source of truth for structure. Tables are `"event"`, `"tag"`, `"junction"` (many-to-many).

## Conventions and gotchas

- Keep SQL in the router; move only duplicated cross-route logic into `controller/`.
- Always quote the table names `"event"` / `"tag"` / `"junction"`; the composite `(event_id, tag_id)` PK backs `ON CONFLICT DO NOTHING`.
- Multi-statement writes use `pool.connect()` with explicit `BEGIN`/`COMMIT`/`ROLLBACK` (see `postEvent`, `updateEvent`). `syncEventTags` runs on the caller's client so it joins that transaction. Single-statement routes use `pool.query` directly.
- Tag ids must be positive integers. Query-string tag values (`?tag=`) are coerced from strings; JSON body `tags` are validated without coercion, so `["1"]` is rejected but `?tag=1` is accepted.
- Tag filtering uses `?match=all|any`: `all` (default) requires every requested tag, `any` requires at least one; other values are `400`. `getEvent` applies it with `count(...) FILTER (WHERE ...)` in `HAVING` so its returned `tags` array stays the event's full tag list.
- `postEvent`/`updateEvent` reject `start_time`/`end_time` strings without a UTC offset (`checkTimestampOffsets`): Postgres would read them in the DB session's time zone, not the event's `timezone` column. A missing `end_time` on create becomes `start_time`; `end_time` before `start_time` is `400`, equal is allowed.
- `associate_links` is stored as `[{label, url}]` (older rows may hold the `{}` default).
- `updateEvent` builds its `SET` clause from a column whitelist and only binds values; never interpolate request data into SQL.
- Deleting an event cascades away its `junction` rows but never deletes tags (tags are a shared vocabulary).
- `.env` is gitignored and contains a real local DB password — never print it or commit it. `dotenv.config()` is called in both `index.js` and `db/db.js`.
- The root package is unused. `frontend/` is a React + Vite app that does not call this API yet (CORS is commented out in `index.js`); see the root `CLAUDE.md`.
