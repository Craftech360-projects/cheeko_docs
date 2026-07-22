// Runnable check for the auth scheme: node --experimental-strip-types test/auth.test.mjs
import assert from 'node:assert';
import { createSession, verifySession, emailAllowed } from '../lib/auth.ts';

const SECRET = 'test-secret-please-change';

// Domain allowlist
assert.equal(emailAllowed('a@craftech360.com'), true);
assert.equal(emailAllowed('b@altio.me'), true);
assert.equal(emailAllowed('c@CRAFTECH360.COM'), true, 'case-insensitive');
assert.equal(emailAllowed('d@gmail.com'), false);
assert.equal(emailAllowed('e@evil-craftech360.com'), false, 'no suffix match');
assert.equal(emailAllowed('notanemail'), false);

// Session round-trip
const s = await createSession('a@craftech360.com', SECRET);
assert.equal(await verifySession(s, SECRET), 'a@craftech360.com');

// Tampered signature rejected
assert.equal(await verifySession(s.slice(0, -1) + (s.at(-1) === 'x' ? 'y' : 'x'), SECRET), null);

// Wrong secret rejected
assert.equal(await verifySession(s, 'other-secret'), null);

// Garbage rejected
assert.equal(await verifySession('nonsense', SECRET), null);
assert.equal(await verifySession(undefined, SECRET), null);

console.log('OK — all auth checks passed');
