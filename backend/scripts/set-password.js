// Usage (from backend/): npm run set-password
// Asks for the Cwenda password twice (not echoed) and writes APP_PASSWORD_HASH and a
// fresh SESSION_SECRET into backend/.env. A new secret logs out every device.
// Never prints either value. CWENDA_ENV_FILE overrides the target file (for tests).
import { randomBytes } from 'node:crypto';
import { chmodSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../controller/auth.js';

const envPath = process.env.CWENDA_ENV_FILE || fileURLToPath(new URL('../.env', import.meta.url));
const MIN_LENGTH = 8;

function fail(message) {
    console.error(message);
    process.exit(1);
}

// Raw-mode prompt so the password never appears on screen.
function askHidden(question) {
    return new Promise((resolve) => {
        const { stdin, stdout } = process;
        stdout.write(question);
        stdin.setRawMode(true);
        stdin.setEncoding('utf8');
        stdin.resume();
        let value = '';
        const onData = (text) => {
            for (const ch of text) {
                if (ch === '\r' || ch === '\n') {
                    stdin.setRawMode(false);
                    stdin.pause();
                    stdin.off('data', onData);
                    stdout.write('\n');
                    return resolve(value);
                }
                if (ch === '\u0003') { // Ctrl+C
                    stdin.setRawMode(false);
                    stdout.write('\n');
                    process.exit(130);
                }
                if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
                else value += ch;
            }
        };
        stdin.on('data', onData);
    });
}

async function readPasswords() {
    if (process.stdin.isTTY) {
        return [await askHidden('New Cwenda password: '), await askHidden('Repeat it: ')];
    }
    // Piped input (scripts/tests): first two lines.
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    return text.split(/\r?\n/).slice(0, 2);
}

// Replace KEY=... if present, otherwise append. Other lines are left untouched.
function upsert(text, key, value) {
    const line = `${key}=${value}`;
    const pattern = new RegExp(`^\\s*${key}\\s*=.*$`, 'm');
    if (pattern.test(text)) return text.replace(pattern, () => line);
    return `${text}${text && !text.endsWith('\n') ? '\n' : ''}${line}\n`;
}

const [password, repeat] = await readPasswords();
if (!password || password.length < MIN_LENGTH) fail(`Password must be at least ${MIN_LENGTH} characters.`);
if (password !== repeat) fail("Passwords don't match.");

const hash = await hashPassword(password);
const secret = randomBytes(32).toString('base64url');

let text = '';
if (existsSync(envPath)) {
    text = readFileSync(envPath, 'utf8');
    copyFileSync(envPath, `${envPath}.bak`);
    chmodSync(`${envPath}.bak`, 0o600); // the backup holds the DB password too
}
text = upsert(upsert(text, 'APP_PASSWORD_HASH', hash), 'SESSION_SECRET', secret);
writeFileSync(envPath, text, { mode: 0o600 });

console.log(`Password saved to ${envPath} (previous file kept as .env.bak).`);
console.log('Restart the backend (nodemon does not reload on .env changes). Every device must log in again.');
