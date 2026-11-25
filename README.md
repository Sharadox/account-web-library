# @sharadox/account-web-library

Passwordless accounts for web applications, built on open standards, with no auth framework:

- one-time codes sent to a contact;
- two-factor codes from authenticator apps (TOTP);
- roles and bans per application;
- OpenID Connect for people and agents.

One deployment per company. Everything company-specific is configuration.

**Status: 0.1.0, in progress.** Sign-in by emailed code with optional two-factor (authenticator apps and recovery
codes), and everything an account manages for itself: name, identifier, picture, contacts, devices, activity, data
export and deletion. Roles, bans and the OpenID Connect server come next (see `CHANGELOG.md`).

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
   Each send is recorded in the audit log as `code.sent`, or as `code.delivery-failed` with the error, never the
   code.
   Otherwise it answers `refused` with `proof`, `contact`, `unavailable` (the cap is reached: sending pauses), or
   `rate-limit` with `retryAfterSeconds`. The answer never depends on whether an account exists.

3. `finishSignIn(server, { requestId, code, address, token, now? })` limits guesses per address group. It answers:
   - `signed-in`, with `{ accountId, token }`: set `token` as the cookie;
   - `more`, with `{ ticket, methods, recoveryCode }`, when other required methods are left (step 5);
   - `sign-up`, with `{ ticket }`, for a contact with no account (nothing is saved until step 4);
   - `refused`, with the code's reason or `rate-limit`.
4. `finishSignUp(server, { ticket, name, identifier, token, userAgent?, now? })` creates the account and signs it
   in. A refused name or identifier can be tried again with the same ticket, which lasts 15 minutes.
5. **Authentication methods** (`authentication-method`, `sign-in-step`): an account's verified sign-in emails and
   its authenticator apps (any number, each named). Each can be **required**: then every sign-in passes it. Without
   any required method one is enough; with some, all of them, in any order, after the first.
   - `startSignInWithIdentifier(server, { identifier, solution, address, now? })` starts with an identifier instead
     of an email: `choose` with the account's `methods` (emails only hinted at: `a•••@example.com`).
   - `sendSignInStepCode(server, { ticket, contactId, address, language })` sends an email step's code.
   - `finishSignInStep(server, { ticket, step, address, token, userAgent?, now? })` takes one step:
     `{ kind: "email", requestId, code }`, `{ kind: "authenticator", id, code }` (never the same 30-second step
     twice) or `{ kind: "recovery-code", code }` (single use; stands in for an authenticator). It answers
     `signed-in`, `more` (with what's left; tickets last 10 minutes) or `refused`. Guesses are limited per
     account and per address group.
   - `authenticationMethods(database, { accountId })`, `setMethodRequired(database, { accountId, kind, id,
required })` (step-up first), `contactHint(contact)`.

A sign-in on a browser new to the account system answers with `notify`: call it after answering, to tell every
email (`new-sign-in`).

Pass `token` (the cookie) to `startSignIn` too: a contact of an account already signed in on that browser gets
`{ status: "signed-in", accountId }` and no code. Codes are 6 digits, shown in emails one box per digit, under
subjects that start with "Account · " ("Conta · "). A used code request forgets the address it was sent to. Identifiers are
always stored and passed without the `@` that the interface shows in front of them.

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
- every row's id is a UUIDv7, and foreign keys cascade updates and deletes (an application with audit events
  can't be deleted);
- identifiers live in one table for everything that has one (accounts now, organizations later), follow the rules,
  and are unique without regard to case; every account keeps exactly one;
- names have 1 to 50 characters, trimmed, with no control characters;
- a verified contact belongs to one account only;
- every person keeps at least one verified sign-in contact, checked when a change commits;
- agents have an owner (and go with them);
- the audit log is never changed.

Tests: `createTestAccountDatabase()` (`test-database`) gives a migrated Postgres in memory (PGlite, a development
dependency).

## API

Each export has its own entry point (`@sharadox/account-web-library/<name>`).

### `account-name`: `checkAccountName(name)`, `ACCOUNT_NAME_MAXIMUM_LENGTH`

The name an account shows: any letters and symbols, 1 to 50 characters once trimmed and with runs of spaces made
single, and no control characters. `checkAccountName("  Luís   Pires ")` → `{ valid: true, name: "Luís Pires" }`.

### `identifier`: `checkIdentifier(name)`, `identifierKey(name)`, `IDENTIFIER_MAXIMUM_LENGTH`

The rules:

- 1 to 50 characters;
- A–Z, a–z and 0–9, with `-`, `_` or `.` allowed only between letters or digits, never two in a row;
- shown as written, but unique without regard to case: `abc` and `aBc` are the same identifier.

```ts
checkIdentifier("Luis-Pires"); // { valid: true, identifier: "Luis-Pires", key: "luis-pires" }
checkIdentifier("a--b"); // { valid: false, reason: "characters" }
```

Store `key` under a unique index.

### `one-time-code`: `createOneTimeCode(length = 6)`, `hashOneTimeCode(code, { pepper, purpose })`, `matchesOneTimeCode(code, hash, { pepper, purpose })`

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

### `person-account`: `createPersonAccount(database, { name, identifier, contact, now? })`

Creates a person with the contact their one-time code just proved, stored verified, and records `account.created`.
Returns `{ created: true, accountId, contactId }`, or `{ created: false, reason }` with `name-invalid`,
`identifier-invalid`, `identifier-taken` or `contact-taken`.

### `identifier-availability`: `identifierAvailability(database, identifier)` → `available` | `taken` | `invalid`

Rate limit it: it tells whether an account exists.

### `identifier-change`: `changeIdentifier(database, { accountId, identifier })`

Any time, and the old name is free at once; the audit log keeps `{ from, to }`. Reasons: `identifier-invalid`,
`identifier-taken`, `no-account`.

### `contact-lookup`: `findAccountByContact(database, contact)` → `{ accountId, contactId, signIn }` or undefined

Verified contacts only, normalized first.

### `contact-addition`, `contact-verification`, `contact-removal`

- `addContact(database, { accountId, contact, now? })` adds it unverified. Reasons: `already-added`,
  `contact-taken`, `no-account`.
- `verifyContact(database, { accountId, contactId, now? })` once its code came back. Reasons: `no-contact`,
  `contact-taken` (another account verified it first).
- `removeContact(database, { accountId, contactId })`. Reasons: `no-contact`, `last-sign-in-contact`.

Each is recorded in the audit log. Ask for a fresh code first (step-up) and tell the other contacts.

### `code-request`: `requestCode(database, { purpose, contact, accountId?, pepper, length = 6, lifetimeSeconds = 600, now? })` → `{ requestId, code, contact, expiresAt }`

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
  undefined. `accounts` are `{ accountSessionId, accountId, identifier, name, pictureId, signedInAt, secondFactorAt }`, in sign-in
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

## Managing an account

Everything a person can do with their own account. Ask for a fresh code first (step-up) before changing contacts,
two-factor or recovery codes, and before deleting the account.

### `step-up`: `startStepUp(server, { accountId, contactId, address, language })`, `finishStepUp(server, { accountId, requestId, code, token })`, `hasFreshStepUp(database, { accountId, token })`

A code to one of the account's own verified contacts. Once it comes back, this browser's session of the account is
confirmed for 10 minutes (`STEP_UP_SECONDS`): check `hasFreshStepUp` before every sensitive change.

### `code-sending`: `sendCode(server, { purpose, contact, channel, accountId?, address, language })`

What every flow above uses to send a code: rate limits per contact, per address group and for everyone, the
channel's daily cap, then `deliver` to call after answering, recorded as `code.sent` or `code.delivery-failed`.

### `account-name-change`: `changeAccountName(database, { accountId, name })`

Reasons: `name-invalid`, `no-account`. The audit log records that it changed, not the names.

### Pictures: `picture-preparation`, `account-picture-change`, `picture-key`, `picture-storage/type`, `memory-picture-storage`

- `preparePicture(bytes)` takes JPEG, PNG, GIF, WebP, AVIF or SVG, up to 5 MB and 4096 pixels, and gives WebP of at
  most 1024 pixels on the longer side. Metadata (a photo's location) is dropped and its rotation applied; GIFs stay
  animated; SVGs are drawn into an image, so nothing in them can run. It refuses (`reason`) `size`, `type`,
  `dimensions`, `suspicious` (far more bytes than the picture needs: something is hidden in it) and `unsafe` (an SVG
  that loads anything from outside itself, or declares entities).
- `setAccountPicture(database, storage, { accountId, bytes })` → `{ changed: true, pictureId }`: the new file is
  stored first, then the old one is deleted. `removeAccountPicture(database, storage, { accountId })`.
- Files live in object storage under `pictureKey(pictureId)` (`account-picture/<id>.webp`). The application gives a
  `PictureStorage` (`put(key, bytes, contentType)`, `remove(key)`); tests use `createMemoryPictureStorage()`.

### Contacts: `contact-addition-flow`

`startContactAddition(server, { accountId, contact, address, language })` adds the contact unverified and sends it a
code (asking again sends a new one); `finishContactAddition(server, { accountId, requestId, code })` verifies it.
Removing one is `removeContact` (the last sign-in contact can't go).

### Authenticators: `totp-setup`, `recovery-code-regeneration`, `secret-encryption`

- `startTotpSetup(server, { accountId, issuer, name })` → `{ status: "started", id, uri, secret }` (or `name`,
  `no-account`): show `uri` as a QR code and `secret` for typing in. An account can have any number; a new setup
  replaces only an unfinished one. The secret is stored encrypted (AES-256-GCM, key derived from `ACCOUNT_SECRET`).
- `confirmTotpSetup(server, { accountId, id, code })` turns it on with the app's first right code. Recovery codes
  are then **offered**, never made unasked: `regenerateRecoveryCodes(server, { accountId })` makes 10 to show once
  (only their HMACs are stored; old ones stop working).
- `renameTotp(database, { accountId, id, name })`, `removeTotp(database, { accountId, id })` (the recovery codes go
  with the last authenticator), `totpStatus(database, { accountId })` → `{ authenticators: [{ id, name, required,
createdAt }], recoveryCodesLeft }`.

### Notifications: `notice-kind`, `account-notice`, `notification-inbox`, `notification-preference`

- `notifyAccount(server, { accountId, notice, except? })` puts a notice in the account's inbox (the bell) and sends it
  to every verified contact but `except`, each unless the owner turned that channel off.
- `NOTICE_KINDS`: `new-sign-in`, `contact-added`, `recovery-code-used` (security: one channel always stays on) and
  `inactivity-warning` (always by email).
- `listNotifications(database, { accountId, limit = 20, before? })` → `{ notifications, unread, more }`;
  `markNotificationsRead(database, { accountId, ids? })`; `deleteNotification(database, { accountId, id })`;
  `pruneNotifications(database, { before })`.
- `notificationPreferences(database, { accountId })`, `setNotificationPreference(database, { accountId, kind,
channel: "in-app" | "email", enabled })` → `changed` or `last-channel` / `locked` / `kind`,
  `noticeEnabled(database, { accountId, kind, channel })`.

### Birthday: `account-birthday`

Optional, for a birthday gift: `setBirthday(database, { accountId, birthday: { day, month, year? } | null })`,
`accountBirthday(database, { accountId })`, `checkBirthday(birthday, { now?, minimumAge = MINIMUM_AGE (16) })`: a
day that exists (29 February only in a leap year, when the year is given) and, with a year, an owner at least 16.

### Roles: `role-deletion`

`roleHolders(database, { application, role })` (how many grants deleting it takes away) and `deleteRole(database, {
application, role, actorAccountId })`: every grant goes with it; the default role and ban roles are protected.

### Nightly: `account-maintenance`

`runAccountMaintenance(server, storage, { now? })` prunes expired code requests (and the addresses they hold), rate
limits, challenges, sessions, ended bans, audit events and notifications older than a year (`pruneAuditEvents`),
then runs the inactivity job.

### Devices, activity, export and deletion

- `listAccountSessions(database, { accountId, token })` → devices (`userAgent`, `signedInAt`, `lastSeenAt`,
  `secondFactor`, `current`), most recently seen first; `signIn` stores each browser's User-Agent (`userAgent`).
- `endAccountSession(database, { accountId, accountSessionId })` signs out one device.
- `listAccountActivity(database, { accountId, before?, limit = 50 })` → `{ events, next }`, newest first.
- `exportAccount(database, { accountId })` → everything stored about the account as JSON-ready data, never secrets.
- `deleteAccount(database, storage, { accountId })` deletes the picture file, then the account and everything that
  belongs to it; its identifier is free at once and the audit log keeps `account.deleted` under the bare id.

Tests: `createTestPerson(database, identifier)` (`test-person`).

## Roles and permissions

Every application declares its permissions and roles in code, and the account system answers what an account may
do there.

- `syncApplication(database, { key, name, permissions, roles })` (`application-sync`): run at every deploy. Each
  permission starts with the application's key (`platform.job.read`); a role lists permissions, and may be the
  application's `default` (every account holds it, with no grant) or `exclusive` (while granted, only its
  permissions count: a ban). Undeclared permissions and roles go, except a role still granted. Refusals:
  `foreign-permission`, `unknown-permission`, `defaults` (more than one).
- `grantRole(database, { accountId, application, role, resource?, startsAt?, endsAt?, source?, grantedBy?, reason? })`
  (`role-grant`) → `{ granted: true, grantId }` or a reason (`no-role`, `no-account`, `not-allowed`, `escalation`).
  Given by someone, it needs their `account.role.assign` (`ROLE_ASSIGN_PERMISSION`, in the `account` application)
  and every permission of the role: nobody hands out more than they hold. `revokeGrant(database, { grantId,
revokedBy? })` ends it now (history kept); `listGrants(database, { accountId })` lists them with `active`.
- `accountPermissions(database, { accountId, application, resource?, scope? })` (`account-permission`) → the set of
  permissions now: the default role plus active grants (an active exclusive one wins), limited to `scope`, and for an
  agent to what its owner may do right now. Built on `effectivePermissions`.

The account system's own application is `ACCOUNT_APPLICATION` (`account-application`): permissions to see the
administration, read and give roles, ban and decide appeals; roles `administrator`, `moderator` and the ban.
`setUpAccountSystem(database, { administrators })` (`account-setup`) syncs it and makes the identifiers listed
(`ACCOUNT_ADMINISTRATORS`) administrators when they aren't: run it at start and after sign-ins.

In the database (migration `0005-role`): `permission`, `role`, `role_permission`, `role_grant`. A role still
granted can't be deleted (`RESTRICT`); a grant outlives the account that gave it (`granted_by` becomes null).

## Rules, bans and appeals

- `syncRules(database, { application, rules })` (`rule-sync`): public rules, the application's own or global
  (`application: null`), each with its words per language and its penalty schedule (seconds or `"permanent"` for the
  1st, 2nd… offense; the last repeats). A changed rule gets a new version; bans keep the version they cited.
  `listRules(database, { application })` gives the newest versions, for the public rules page.
- `banAccount(database, { accountId, application, rules, statement, evidence?, by? })` (`account-ban`): the length
  comes from the rules (this offense for each, per account, rule and application; the longest wins), so equal
  offenses get equal penalties. The ban is the application's exclusive role, granted until then or for good. `by`
  needs `account.ban.create` (`BAN_PERMISSION`). Refusals: `not-allowed`, `no-rule`, `no-ban-role`.
- `appealBan(database, { banId, accountId, text })`: one appeal per ban, by the banned account.
  `decideAppeal(database, { appealId, by, decision, reasons, endsAt? })`: `upheld`, `shortened` (to `endsAt`) or
  `lifted`, once, by someone with `account.appeal.decide` (`APPEAL_PERMISSION`). `listBans(database, { accountId })`.
- The banned-contact ledger (`banned-contact`): deleting a banned account (`deleteAccount` now takes
  `ledgerPepper`, `deriveSecret(ACCOUNT_SECRET, "banned-contact")`) keeps each verified contact's HMAC (emails
  without `+tags`) until the ban ends. `finishSignUp` and `startContactAddition` refuse such a contact
  (`contact-banned`); `contactBanned(database, { contact, pepper, application })` asks directly;
  `pruneBannedContacts(database)` forgets ended ones (a daily job).

In the database (migration `0006-rule-ban`): `rule`, `ban`, `ban_rule` (a cited rule version can't be deleted),
`appeal` (one per ban), `banned_contact` (no link to any account).

## License

Sharadox Open Source License 0.1.0 (see `LICENSE.md`).
