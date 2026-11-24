# Changelog

What changed in each version of `@sharadox/account-web-library`, newest first.

## 0.1.0

First building blocks:

- usernames (`checkUsername`, `usernameKey`);
- one-time codes (`createOneTimeCode`, `hashOneTimeCode`, `matchesOneTimeCode`);
- TOTP two-factor (`createTotpSecret`, `totpCode`, `verifyTotp`, `totpUri`), tested against the RFC 6238 vectors;
- base 32.
