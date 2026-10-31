// Self-check: node controller/auth.check.js   (run from backend/)
import assert from 'node:assert/strict';
import {
    createLoginLimiter, hashPassword, readCookie, sessionCookie, signSession, verifyPassword, verifySession,
} from './auth.js';

// Passwords: right, wrong, malformed stored values; two hashes of one password differ (random salt).
const stored = await hashPassword('correct horse');
assert.match(stored, /^scrypt\$32768\$8\$1\$[\w-]+\$[\w-]+$/);
assert.equal(await verifyPassword('correct horse', stored), true);
assert.equal(await verifyPassword('wrong horse', stored), false);
assert.equal(await verifyPassword('', stored), false);
assert.equal(await verifyPassword(undefined, stored), false);
for (const bad of ['', 'plain', 'scrypt$1$2$3', 'bcrypt$32768$8$1$a$b', 'scrypt$x$8$1$abc$def']) {
    assert.equal(await verifyPassword('correct horse', bad), false, bad);
}
assert.notEqual(await hashPassword('correct horse'), stored);

// Sessions: valid, tampered, expired, other secret, junk.
const secret = 'test-secret';
const now = 1_800_000_000_000;
const token = signSession(secret, now);
assert.equal(verifySession(token, secret, now), true);
assert.equal(verifySession(token, secret, now + 29 * 86_400_000), true);
assert.equal(verifySession(token, secret, now + 31 * 86_400_000), false); // past 30 days
assert.equal(verifySession(token, 'other-secret', now), false);
const [v, exp, sig] = token.split('.');
assert.equal(verifySession(`${v}.${Number(exp) + 1e9}.${sig}`, secret, now), false); // extended expiry
assert.equal(verifySession(`${v}.${exp}.${sig.slice(0, -1)}x`, secret, now), false);
for (const junk of [null, '', 'abc', 'v2.1.x', `v1..${sig}`]) assert.equal(verifySession(junk, secret, now), false, String(junk));
assert.equal(verifySession(token, '', now), false); // no secret configured

// Cookies.
assert.equal(readCookie(`a=1; cwenda_session=${token}; b=2`, 'cwenda_session'), token);
assert.equal(readCookie('a=1', 'cwenda_session'), null);
assert.equal(readCookie(undefined, 'cwenda_session'), null);
assert.equal(readCookie('cwenda_session=%E0%A4%A', 'cwenda_session'), null); // bad encoding
assert.match(sessionCookie('x', 60), /^cwenda_session=x; HttpOnly; SameSite=Strict; Path=\/; Max-Age=60$/);

// Limiter: 5 failures lock for 1 minute; success resets; old failures expire.
const limiter = createLoginLimiter();
for (let i = 0; i < 4; i++) limiter.fail(now);
assert.equal(limiter.retryAfterMs(now), 0);
limiter.fail(now);
assert.equal(limiter.retryAfterMs(now), 60_000);
assert.equal(limiter.retryAfterMs(now + 60_000), 0);
const spread = createLoginLimiter();
for (let i = 0; i < 5; i++) spread.fail(now + i * 4 * 60_000); // 5 failures over 16 minutes
assert.equal(spread.retryAfterMs(now + 16 * 60_000), 0);
const reset = createLoginLimiter();
for (let i = 0; i < 4; i++) reset.fail(now);
reset.succeed();
reset.fail(now);
assert.equal(reset.retryAfterMs(now), 0);

console.log('auth ok');
