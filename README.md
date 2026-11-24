# @sharadox/account-web-library

Passwordless accounts for web applications, built on open standards, with no auth framework:

- one-time codes sent to a contact;
- two-factor codes from authenticator apps (TOTP);
- roles and bans per application;
- OpenID Connect for people and agents.

One deployment per company. Everything company-specific is configuration.

**Status: 0.1.0, building blocks.** Usernames, base 32, TOTP and one-time codes. Accounts, contacts, sessions, roles,
bans and the OpenID Connect server come next (see `CHANGELOG.md`).

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

## License

Sharadox Open Source License 0.1.0 (see `LICENSE.md`).
