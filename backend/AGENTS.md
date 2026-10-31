# AGENTS.md

Express 5 + PostgreSQL REST API for managing calendar events and tags. All commands run from this `backend/` directory, not the repo root (the root `package.json` is an empty CommonJS stub; this package is ESM).

## Commands

- `npm run dev` — starts nodemon on `index.js` (listens on `PORT` from `.env`, currently 5200).
- `npm test` — intentionally fails (`exit 1`). There is no test suite; don't assume one exists.
- Apply schema: `psql -d cwenda -f db/schema.sql` (idempotent, structure only, no seed data).

## Layout

- `index.js` — entrypoint: loads dotenv, mounts the router at `/api`, adds a JSON error middleware, verifies DB connectivity with `SELECT 1` on listen.
- `db/db.js` — exports a single `pg` `Pool`; DB connection comes entirely from `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DB`).
- `router/router.js` — all routes and SQL. Endpoints: `GET /api/getEvent` (optional `?start_time=`/`?end_time=` ISO range, returns events overlapping it, defaulting to the current month in server local time; optional `?tag=` + `?match=`), `GET /api/getEvent/:id`, `GET /api/getAllTags` (distinct `{id, name}`, includes tags with no events), `GET /api/getTagUsage` (`{id, name, event_count}` per tag), `GET /api/getEventByTag` (requires `?tag=`; `?match=all|any`), `POST /api/postEvent`, `POST /api/postTag` (`{name}`, trimmed; duplicate name is `409`), `PUT /api/updateTag/:id` (`{name}`, same rules), `DELETE /api/deleteTag/:id` (unlinks it from every event via `fk_tag` cascade; events stay), `POST /api/mcv/import` (see below), `PUT /api/updateEvent/:id`, `DELETE /api/deleteEvent/:id`.
- `controller/controller.js` — shared helpers only (`parseTagIds`, `parseMatchMode`, `parseTagName`, `checkTimestampOffsets`, `mapPgError`, `syncEventTags`); no SQL lives here.
- `controller/mcv.js` — MyCourseVille import: `fetchAssignments()` runs the `mcv` CLI (`execFile`, fixed args, 2 min timeout; binary from `MCV_BIN` in `.env`, else `mcv` on PATH) and `toEventFields()` maps one assignment. Self-check: `node controller/mcv.check.js`.
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

## Deployment
- `index.js` serves `../frontend/dist` (when it has an `index.html`) after the `/api` router, with an `index.html` fallback for non-`/api` GETs. `HOST` env picks the listen address (unset = all interfaces).
- `scripts/deploy.sh` builds the frontend, writes `~/Library/LaunchAgents/com.cwenda.server.plist` (PORT=5300, NODE_ENV=production, PATH with `~/.local/bin` for `mcv`, RunAtLoad, KeepAlive, ThrottleInterval 10) and reloads it with `launchctl bootout`/`bootstrap gui/$UID`. Re-run after Node moves (the plist pins `which node`).
- Never kill or test against port 5300 casually: it's the user's live app. Test on 5299.

## Auth (single password)
- `controller/auth.js` + `app.use('/api', requireAuth, router)` in `index.js`. Every `/api` route needs the `cwenda_session` cookie except `GET /session`, `POST /login`, `POST /logout`. Add new public routes to `OPEN_PATHS` only deliberately.
- No session: 401 `{code: "auth_required"}` (the frontend shows the login page only for this code; MCV's own 401 has a different code). No password configured: 503 `auth_not_configured` (fails closed).
- `.env` keys `APP_PASSWORD_HASH` (`scrypt$N$r$p$salt$hash`) and `SESSION_SECRET`, written by `npm run set-password` (also makes `.env.bak`). Re-running it rotates the secret, logging out every device. Restart the server after; nodemon ignores `.env`.
- Cookie: stateless HMAC-signed expiry, 30 days, `HttpOnly; SameSite=Strict`, no `Secure` (plain http). Login limiter: 5 wrong in 15 min locks 1 min, in memory.
- Self-check: `node controller/auth.check.js`. Live tests: pass `APP_PASSWORD_HASH`/`SESSION_SECRET` as env vars to `PORT=5299 node index.js` (dotenv won't override them) so `.env` stays untouched.

## MyCourseVille import

- Requires the external `mcv` CLI (github.com/Okumans/mcv-cli, installed with `uv tool install`, pinned commit) and a session from `mcv auth login`. The session lives in the macOS Keychain; Cwenda never sees the cookie or password.
- `POST /api/mcv/import` imports all current-semester assignments (`mcv --json assignments list`, submitted or not) as zero-length events at the due time (`duedate` text like `"Due on 05 November 2026 at 09:00"`, read as Bangkok UTC+7), tagged `MCV` + course number, link to `detail_url`, `timezone = 'Asia/Bangkok'`.
- `event.mcv_ref` (unique, NULL for normal events) holds the mcv ref (`mcv:assignment:<cv_cid>:<itemid>`). `event.mcv_submitted` is `true` when mcv's `submitted_at` is present and non-empty, else `false` (NULL for normal events); `getEvent` and `getEvent/:id` return both columns. Re-imports upsert on `mcv_ref` and refresh only `name`, `start_time`, `end_time`, `mcv_submitted`; tags, links and notes the user changed are kept. Assignments without a readable due date are returned as `skipped`.
- Errors: `401` when mcv reports a `session` error (not logged in / expired), `503` when the binary is missing, `504` on timeout, `502` for other mcv failures, `409` while another import is running. The whole import is one transaction.
- Testing gotcha: the user often runs `npm run dev` (nodemon) on port 5200. Test with your own process on another port (`PORT=5299 node index.js &`, then `kill $!`); never `pkill -f "node index.js"`, which also kills the user's server.
