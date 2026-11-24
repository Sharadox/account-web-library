# Changelog

What changed in each version of `@sharadox/account-web-library`, newest first.

## 0.1.0

First building blocks:

- usernames (`checkUsername`, `usernameKey`);
- one-time codes (`createOneTimeCode`, `hashOneTimeCode`, `matchesOneTimeCode`);
- TOTP two-factor (`createTotpSecret`, `totpCode`, `verifyTotp`, `totpUri`), tested against the RFC 6238 vectors;
- base 32;
- recovery codes (`createRecoveryCodes`, `normalizeRecoveryCode`);
- email contacts (`normalizeEmail`, `emailLedgerForm`);
- effective permissions per application (`effectivePermissions`), where bans are exclusive roles;
- ban lengths from rule schedules (`banLength`);
- account storage in Postgres (`migrateAccount`, `AccountDatabase`, `createTestAccountDatabase`): applications,
  accounts, contacts and an append-only audit log, with the rules enforced by the database;
- `createPersonAccount`, `usernameAvailability`, `changeUsername`, `findAccountByContact`, `addContact`,
  `verifyContact`, `removeContact`, `normalizeContact`, `recordAuditEvent` and `databaseError`.
