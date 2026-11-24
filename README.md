# @sharadox/account-web-library

Passwordless accounts for web applications, built on open standards, with no auth framework:

- one-time codes sent to a contact;
- two-factor codes from authenticator apps (TOTP);
- roles and bans per application;
- OpenID Connect for people and agents.

One deployment per company. Everything company-specific is configuration.

**Status: 0.1.0, building blocks.** Usernames, one-time codes, TOTP, recovery codes, email contacts, effective
permissions and ban lengths. Accounts, contacts, sessions, storage and the OpenID Connect server come next (see
`CHANGELOG.md`).

## Install

```sh
pnpm add @sharadox/account-web-library
```

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

## License

Sharadox Open Source License 0.1.0 (see `LICENSE.md`).
