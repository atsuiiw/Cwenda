import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import cors from 'cors';

// dotenv
dotenv.config();
const PORT = process.env.PORT;
// const FRONTEND_URL = process.env.FRONTEND_URL;

// initialize app variable
const app = express();
app.use(express.json());

// app.use(cors({
//   origin: FRONTEND_URL,
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true,
// }));

// databse connection
import pool from './db/db.js';

// import router
import router from './router/router.js';
import { requireAuth } from './controller/auth.js';

// Every /api route needs a session except /login, /logout and /session.
app.use('/api', requireAuth, router);

// Deployed mode: serve the built frontend (npm run build in frontend/) from this same port.
// Any non-/api GET falls back to index.html so client routes like /calendar load directly.
const DIST = fileURLToPath(new URL('../frontend/dist', import.meta.url));
if (existsSync(`${DIST}/index.html`)) {
  app.use(express.static(DIST));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path === '/api' || req.path.startsWith('/api/')) return next();
    res.sendFile(`${DIST}/index.html`);
  });
}


app.use((err, req, res, next) => {
  console.error("MIDDLEWARE ERROR:", err);
  res.status(err.status || 500).json({ message: err.message });
});

app.listen(PORT, process.env.HOST, async () => {
    try {
        await pool.query('SELECT 1');
        console.log("Connected at " + PORT);
    } catch (err) {
        console.error("Database connection failed:", err.message);
    }
});
