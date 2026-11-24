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
  `verifyContact`, `removeContact`, `normalizeContact`, `recordAuditEvent` and `databaseError`;
- one-time code requests in Postgres (`requestCode`, `verifyCode`, `pruneCodeRequests`) for sign-in, contact
  verification and step-up;
- sessions for the account selector (`signIn`, `readBrowserSession`, `signOut`, `revokeAccountSessions`,
  `pruneSessions`, `createSessionToken`, `hashSessionToken`): one browser cookie, any number of accounts, a new token
  at every sign-in;
- the sign-in flow (`issueChallenge`, `startSignIn`, `finishSignIn`, `finishSignUp`) with proof of work, layered
  rate limits and daily sending caps (each send is recorded in the audit log: `code.sent` or `code.delivery-failed`), on one `AccountServer` and its `DEFAULT_SIGN_IN_LIMITS`; `deriveSecret` (HKDF
  keys from one `ACCOUNT_SECRET`), signed tickets (`createTicket`, `readTicket`), `AccountServerDatabase` and
  `createTestServerDatabase`;
- contact channels (`ContactChannel`) and the email channel (`createEmailChannel`), in English and European
  Portuguese.
