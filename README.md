# @sharadox/account-web-library

Passwordless accounts for web applications, built on open standards, with no auth framework:

- one-time codes sent to a contact;
- two-factor codes from authenticator apps (TOTP);
- roles and bans per application;
- OpenID Connect for people and agents.

One deployment per company. Everything company-specific is configuration.

**Status: 0.1.0, in progress.** Building blocks (usernames, one-time codes, TOTP, recovery codes, email contacts,
effective permissions, ban lengths) and account storage in Postgres (accounts, usernames, contacts, audit log).
Sign-in codes, sessions and the OpenID Connect server come next (see `CHANGELOG.md`).

## Install

```sh
pnpm add @sharadox/account-web-library
```

## The sign-in flow

Signing up and signing in are the same three steps, on one `AccountServer`:
`{ database, channels, secret, limits? }`. The database holds the account tables and protection-web-library's
(`migrateProtection` and `migrateAccount`). `secret` is `ACCOUNT_SECRET`: at least 32 random characters, server only.
Every key is derived from it with `deriveSecret`.

1. `issueChallenge(server)` gives the page a proof-of-work challenge, which the browser solves in the background.
2. `startSignIn(server, { contact, solution, address, language, now? })` checks, in this order:
   - the proof of work (single use);
   - the contact and its channel;
   - rate limits per contact, per address group and for everyone;
   - the channel's daily spending cap.

   It answers `{ status: "sent", requestId, deliver }`, and you call `deliver` after answering (Next.js `after()`).
   A failed send is recorded in the audit log as `code.delivery-failed`, with the error but never the code.
   Otherwise it answers `refused` with `proof`, `contact`, `unavailable` (the cap is reached: sending pauses), or
   `rate-limit` with `retryAfterSeconds`. The answer never depends on whether an account exists.

3. `finishSignIn(server, { requestId, code, address, token, now? })` limits guesses per address group. It answers:
   - `signed-in`, with `{ accountId, token }`: set `token` as the cookie;
   - `sign-up`, with `{ ticket }`, for a contact with no account;
   - `refused`, with the code's reason or `rate-limit`.
4. `finishSignUp(server, { ticket, username, token, now? })` creates the account and signs it in. A refused
   username can be tried again with the same ticket, which lasts 15 minutes.

`DEFAULT_SIGN_IN_LIMITS` (`account-server`):

| Limit                     | Default                           |
| ------------------------- | --------------------------------- |
| `perContact`              | 3 codes, then 1 every 5 minutes   |
| `perAddress`              | 10, then 1 a minute               |
| `global`                  | 200, then 1 a second              |
| `verificationsPerAddress` | 20 typed codes, then 1 every 30 s |
| `dailySendsPerChannel`    | 2,000                             |
| `difficulty`              | 14 bits                           |

`createTicket` and `readTicket` (`signed-ticket`) carry signed, short-lived data between steps.

## Storage

Postgres through Kysely (`@sharadox/database-web-library`). Run `migrateAccount(database)` when the application
migrates: the tables are tracked in their own table (`account_migration`). Type Kysely with `AccountDatabase`
(`account-database/type`). The database enforces the rules itself, as the last line behind the code:

- ids are UUIDv7;
- usernames follow the rules and are unique without regard to case;
- a verified contact belongs to one account only;
- every person keeps at least one verified sign-in contact, checked when a change commits;
- agents have an owner (and go with them);
- the audit log is never changed.

Tests: `createTestAccountDatabase()` (`test-database`) gives a migrated Postgres in memory (PGlite, a development
dependency).

## API

Each export has its own entry point (`@sharadox/account-web-library/<name>`).

### `username`: `checkUsername(name)`, `usernameKey(name)`, `USERNAME_MAXIMUM_LENGTH`

The rules:

- 1 to 50 characters;
- A–Z, a–z and 0–9, with `-`, `_` or `.` allowed only between letters or digits, never two in a row;
- shown as written, but unique without regard to case: `abc` and `aBc` are the same username.

```ts
checkUsername("Luis-Pires"); // { valid: true, username: "Luis-Pires", key: "luis-pires" }
checkUsername("a--b"); // { valid: false, reason: "characters" }
```

Store `key` under a unique index.

### `one-time-code`: `createOneTimeCode(length = 8)`, `hashOneTimeCode(code, { pepper, purpose })`, `matchesOneTimeCode(code, hash, { pepper, purpose })`

- Codes are uniform random digits.
- Only an HMAC-SHA-256 is stored, under a pepper of at least 32 characters kept outside the database, and bound to
  its purpose (`sign-in:<request id>`).
- Matching ignores spaces and runs in constant time.

### `totp`: `createTotpSecret()`, `totpCode(secret, now, { digits = 6, period = 30 })`, `verifyTotp(secret, code, now, { lastUsedStep })`, `totpUri({ issuer, account, secret })`

RFC 6238 with SHA-1, 6 digits and 30-second steps.

- **Verification:** one step of drift is accepted either side. Steps at or before `lastUsedStep` are refused, so a code
  can't be replayed. Store the returned `step`.
- **`totpUri`:** gives the `otpauth://` address to show as a QR code. Its `secret` parameter is the text to type in.

```ts
const secret = createTotpSecret(); // store encrypted
const address = totpUri({ issuer: "Luis Pires Decor", account: "luis-pires", secret });
const result = verifyTotp(secret, typed, Date.now(), { lastUsedStep });
```

### `base-32`: `encodeBase32(bytes)`, `decodeBase32(text)`

RFC 4648 base 32 without padding. Decoding accepts lowercase, spaces and padding.

### `effective-permissions`: `effectivePermissions({ application, resource?, now, defaultRole, roles, grants, scope?, ownerPermissions? })` → `Set<string>`

What an account may do in one application, now:

1. Active grants count: started, not ended, in the application or global, and for the whole application or the
   resource asked.
2. An active **exclusive** role (a ban) leaves only its own permissions.
3. Otherwise the result is the default role plus every active role.
4. Only the application's permissions (`platform.…`) and the account system's own (`account.…`) are kept.
5. The result is limited to `scope` (a token or key) and to `ownerPermissions` (an agent's owner).

### `ban-length`: `banLength([{ schedule, previousOffenses }])` → seconds or `"permanent"`

- Each rule gives its schedule's penalty for this offense, and the last penalty repeats.
- Several rules broken at once give the longest of their penalties.

### `recovery-code`: `createRecoveryCodes(count = 10)`, `normalizeRecoveryCode(code)`

Codes like `7KQM-W3HD-9TXA` (about 59 bits each), from characters that can't be misread. Hash each one with
`hashOneTimeCode(normalizeRecoveryCode(code), { pepper, purpose: "recovery:<account id>" })`.

### `email-contact`: `normalizeEmail(address)`, `emailLedgerForm(address)`

- `normalizeEmail` trims and lowercases, and throws for text that isn't an email address.
- `emailLedgerForm` also drops `+tags`, for the banned-contact ledger.

### `person-account`: `createPersonAccount(database, { username, contact, now? })`

Creates a person with the contact their one-time code just proved, stored verified, and records `account.created`.
Returns `{ created: true, accountId, contactId }`, or `{ created: false, reason }` with `username-invalid`,
`username-taken` or `contact-taken`.

### `username-availability`: `usernameAvailability(database, username)` → `available` | `taken` | `invalid`

Rate limit it: it tells whether an account exists.

### `username-change`: `changeUsername(database, { accountId, username })`

Any time, and the old name is free at once; the audit log keeps `{ from, to }`. Reasons: `username-invalid`,
`username-taken`, `no-account`.

### `contact-lookup`: `findAccountByContact(database, contact)` → `{ accountId, contactId, signIn }` or undefined

Verified contacts only, normalized first.

### `contact-addition`, `contact-verification`, `contact-removal`

- `addContact(database, { accountId, contact, now? })` adds it unverified. Reasons: `already-added`,
  `contact-taken`, `no-account`.
- `verifyContact(database, { accountId, contactId, now? })` once its code came back. Reasons: `no-contact`,
  `contact-taken` (another account verified it first).
- `removeContact(database, { accountId, contactId })`. Reasons: `no-contact`, `last-sign-in-contact`.

Each is recorded in the audit log. Ask for a fresh code first (step-up) and tell the other contacts.

### `code-request`: `requestCode(database, { purpose, contact, accountId?, pepper, length = 8, lifetimeSeconds = 600, now? })` → `{ requestId, code, contact, expiresAt }`

Starts a one-time code for `sign-in`, `contact-verification` or `step-up`.

- Only an HMAC bound to the purpose and request is stored.
- A new request replaces the open one for the same contact and purpose.
- Send the code after answering the request, so timing reveals nothing. Rate limit and cap the sends first
  (`limitRate`, `spendFromCap` from protection-web-library).

### `code-verification`: `verifyCode(database, { requestId, code, purpose, pepper, maximumAttempts = 5, now? })`

Returns `{ valid: true, contact, accountId }` (the account that asked, null for sign-in), or `{ valid: false, reason }`
with `unknown`, `used`, `replaced`, `expired`, `attempts` or `wrong`. The row is locked, so concurrent guesses can't
pass the limit; after the last attempt even the right code is refused.

### `code-request-prune`: `pruneCodeRequests(database, { before })` → deleted count

### Sessions and the account selector

A browser holds one cookie with an opaque token (only its SHA-256 is stored). On the server, that browser session
points to any number of account sessions, so the selector has no limit and the cookie never grows. Use a
`__Host-` cookie: HttpOnly, Secure, SameSite=Lax, path `/`.

- `signIn(database, { accountId, token?, secondFactor?, accountSessionSeconds = 30 days, browserSessionSeconds = 400 days, now? })`
  → `{ token, browserSessionId, accountSessionId }`. Adds the account to the browser's accounts (or starts a
  browser session). The browser gets a **new token at every sign-in**: set it as the cookie.
- `readBrowserSession(database, { token, idleSeconds = 7 days, now? })` → `{ browserSessionId, accounts }` or
  undefined. `accounts` are `{ accountSessionId, accountId, username, signedInAt, secondFactorAt }`, in sign-in
  order, without ended or idle sessions. It marks them as seen.
- `signOut(database, { token, accountId? })` → `{ signedOut }`: one account, or all and the browser session.
- `revokeAccountSessions(database, { accountId, actorAccountId? })` → count: signed out on every browser.
- `pruneSessions(database, { idleSeconds?, now? })` → `{ accountSessions, browserSessions }`, for a daily job.
- `createSessionToken()`, `hashSessionToken(token)` (`session-token`).

### `email-channel`: `createEmailChannel({ sender, from, design, logos?, now? })` → `ContactChannel`

Sends codes by email through email-web-library's sender, in the shared email layout.

- English, or European Portuguese for any `pt` reader.
- The code is in the body only, never in the subject (lock screens show subjects).
- No link to click: nothing for a phishing email to imitate.

A `ContactChannel` (`contact-channel/type`) is `{ kind, send({ contact, code, purpose, language, expiresAt }) }`:
phone, WhatsApp, Messenger and Instagram channels will have the same shape.

### `contact-kind`: `normalizeContact({ kind, value })`, `CONTACT_KINDS`

`email` in this version; unknown kinds and invalid values throw.

### `audit-event`: `recordAuditEvent(database, { action, accountId?, actorAccountId?, application?, detail?, now? })` → id

Pass the transaction of the change it describes. `detail` holds ids and kinds, never contact values or secrets.

### `database-error`: `databaseError(error)` → `{ code, constraint }` or undefined

## License

Sharadox Open Source License 0.1.0 (see `LICENSE.md`).
