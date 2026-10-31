# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cwenda is a calendar app for events and tags. It is two independent npm packages with no workspace tooling: run every command from inside `frontend/` or `backend/`. The root `package.json` is an unused stub. Git repo (remote `origin`, public on GitHub; branches `main`, `dev`).

## Commands

| | `frontend/` | `backend/` |
|---|---|---|
| Dev server | `npm run dev` (Vite) | `npm run dev` (nodemon, port from `.env` `PORT`, currently 5200) |
| Build | `npm run build` (outputs `dist/`) | none |
| Lint | `npm run lint` (ESLint flat config) | none |
| Tests | none | none (`npm test` exits 1 on purpose) |

Database: `psql -d cwenda -f backend/db/schema.sql` creates the structure (no seed data) and is safe to re-run; keep new statements idempotent (`IF NOT EXISTS`, constraints declared inline in `CREATE TABLE`).

## Architecture

- **backend/**: Express 5 (ESM) + `pg` REST API mounted at `/api`. Routes and all SQL live in `router/router.js`; `controller/controller.js` holds only shared helpers. Tables: `"event"`, `"tag"`, `"junction"` (many-to-many; deleting an event never deletes tags). **Read `backend/AGENTS.md` before touching the backend**: it lists every endpoint, the transaction pattern, the tag validation rules and the SQL conventions.
- **frontend/**: React 19 + Vite 8 with the React Compiler (Babel preset in `vite.config.js`), Tailwind 4 via `@tailwindcss/vite`, react-router 7. Plain JS/JSX, no TypeScript. `AppRouter.jsx` owns the layout (`Navbar` beside `<main>`) and the route table. Styling is Tailwind utility classes inline; `styled-components` and `react-icons` are installed but unused. Fonts: only Micro 5, set on `body` in `assets/main.css` and forced onto every element with `body * { font-family: inherit !important }`, so `font-*` utility classes have no effect load from Google Fonts in `index.html`.

## Current state / gotchas

- **Deployed copy:** a LaunchAgent (`com.cwenda.server`) runs the backend on port **5300** at login, serving the built `frontend/dist` and `/api` from one port; `KeepAlive` restarts it. `npm run deploy` (in `backend/`) rebuilds and restarts it, `npm run undeploy` removes it, `npm run logs` tails `~/Library/Logs/Cwenda/server.log`. Code changes don't reach it until you deploy. Dev (5173/5200) and the deployed copy share the same database. The project lives in `~/Cwenda` because macOS blocks background agents from `~/Desktop`; `deploy.sh` refuses to run from there.

- The frontend reaches the backend through the Vite dev proxy (`/api` -> `localhost:5200` in `vite.config.js`). Backend CORS is still commented out in `backend/index.js`; not needed, since the deployed copy serves frontend and API from the same origin.
- Routed: `/home` and `/calendar` (`pages/calendar.jsx`, Apple-Calendar-style Day/Week/Month; components in `components/Calendar/`). `/event` (upcoming list, `pages/event.jsx`), `/event/new` and `/event/:id` (create/edit form, `pages/eventForm.jsx`). `/` redirects to `/home`. Everything sits behind `components/AuthGate.jsx` (login page `pages/login.jsx`, Log out in the navbar); see Auth in `backend/AGENTS.md`. Frontend API calls go through `src/api.js`.
- Calendar date logic lives in `components/Calendar/dateUtils.js`; its self-check is `TZ=America/New_York node src/components/Calendar/dateUtils.check.js` (run from `frontend/`).
- MyCourseVille import (`POST /api/mcv/import`, "Import from MCV" button on `/event`) shells out to the external `mcv` CLI; see `backend/AGENTS.md`. `mcv/mcv_due.sh` is the older standalone script and is not used by the app.
- `backend/.env` holds real local DB credentials (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DB`, `PORT`) plus the login hash and session secret (`APP_PASSWORD_HASH`, `SESSION_SECRET`). Never print or commit it, or `.env.bak`.
