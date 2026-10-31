// Single-user password login. The password is stored only as a scrypt hash
// (APP_PASSWORD_HASH) and sessions are stateless signed cookies (SESSION_SECRET),
// so logins survive restarts. Env values are read per request: dotenv runs
// after ESM imports are evaluated.
import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
// N=2^15 needs ~32 MB, just over Node's default maxmem, so raise it.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const KEY_LENGTH = 64;

export const SESSION_COOKIE = 'cwenda_session';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // seconds

/** @returns {Promise<string>} "scrypt$N$r$p$<salt>$<hash>" (base64url parts) */
export async function hashPassword(password) {
    const salt = randomBytes(16);
    const hash = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT);
    return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
    if (typeof password !== 'string' || typeof stored !== 'string') return false;
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, salt, hash] = parts;
    const expected = Buffer.from(hash, 'base64url');
    if (expected.length === 0) return false;
    try {
        const actual = await scryptAsync(password, Buffer.from(salt, 'base64url'), expected.length, {
            N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
        });
        return timingSafeEqual(actual, expected);
    } catch {
        return false; // malformed parameters in the stored hash
    }
}

const sign = (payload, secret) => createHmac('sha256', secret).update(payload).digest('base64url');

/** "v1.<expiry ms>.<HMAC of 'v1.<expiry>'>" */
export function signSession(secret, now = Date.now()) {
    const payload = `v1.${now + SESSION_MAX_AGE * 1000}`;
    return `${payload}.${sign(payload, secret)}`;
}

export function verifySession(token, secret, now = Date.now()) {
    if (typeof token !== 'string' || !secret) return false;
    const dot = token.lastIndexOf('.');
    if (dot < 0) return false;
    const payload = token.slice(0, dot);
    const [version, expiry] = payload.split('.');
    if (version !== 'v1' || !/^\d+$/.test(expiry ?? '')) return false;
    const given = Buffer.from(token.slice(dot + 1));
    const expected = Buffer.from(sign(payload, secret));
    return given.length === expected.length && timingSafeEqual(given, expected) && Number(expiry) > now;
}

export function readCookie(header, name) {
    if (typeof header !== 'string') return null;
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
        try {
            return decodeURIComponent(part.slice(eq + 1).trim());
        } catch {
            return null;
        }
    }
    return null;
}

// No Secure flag: the app is served over plain http on the home network.
export const sessionCookie = (value, maxAge) =>
    `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`;

export const isConfigured = () => Boolean(process.env.APP_PASSWORD_HASH && process.env.SESSION_SECRET);

export const isAuthenticated = (req) =>
    verifySession(readCookie(req.headers.cookie, SESSION_COOKIE), process.env.SESSION_SECRET);

/** 5 wrong passwords within 15 minutes locks logins for 1 minute. In memory: one user, one server. */
export function createLoginLimiter({ maxFailures = 5, windowMs = 15 * 60_000, lockMs = 60_000 } = {}) {
    let failures = [];
    let lockedUntil = 0;
    return {
        retryAfterMs: (now = Date.now()) => Math.max(0, lockedUntil - now),
        fail(now = Date.now()) {
            failures = failures.filter((t) => now - t < windowMs);
            failures.push(now);
            if (failures.length >= maxFailures) {
                lockedUntil = now + lockMs;
                failures = [];
            }
        },
        succeed() {
            failures = [];
            lockedUntil = 0;
        },
    };
}

// Routes reachable without a session, relative to the /api mount.
const OPEN_PATHS = new Set(['/login', '/logout', '/session']);

/** Guards every /api route. Fails closed: no password configured means no data. */
export function requireAuth(req, res, next) {
    if (OPEN_PATHS.has(req.path)) return next();
    if (!isConfigured()) {
        return res.status(503).json({
            message: "No password set. Run `npm run set-password` in backend/, then restart the server.",
            code: 'auth_not_configured',
        });
    }
    if (isAuthenticated(req)) return next();
    res.status(401).json({ message: "Log in to Cwenda", code: 'auth_required' });
}
