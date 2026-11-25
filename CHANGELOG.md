# Changelog

What changed in each version of `@sharadox/account-web-library`, newest first.

## 0.1.0

First building blocks:

- a sign-in on a new browser tells every email (`new-sign-in` notice; `signIn` returns `newBrowser`, `finishSignIn`
  and `finishSecondFactor` return `notify`);

- inactivity: `runInactivity` deletes a person unused for 2 years after warnings 6 months, 3 months, 1 month, 1 week
  and 1 day before (`deletionDate`; migration `0007-language-inactivity` adds the account's `language`); notices by email
  (`ContactChannel.notify`: inactivity warnings, a new email, a recovery code used) through `notifyAccount`;

- rules, bans and appeals: `syncRules`, `listRules`, `banAccount`, `appealBan`, `decideAppeal`, `listBans`, and the
  banned-contact ledger (`bannedContactHash`, `contactBanned`, `pruneBannedContacts`; `deleteAccount` takes
  `ledgerPepper`) checked at sign-up and when adding a contact (migration `0006-rule-ban`);

- roles and permissions per application: `syncApplication`, `grantRole`, `revokeGrant`, `listGrants`,
  `accountPermissions` (migration `0005-role`);

- account management: names (`checkAccountName`, `changeAccountName`), pictures (`preparePicture`,
  `setAccountPicture`, `removeAccountPicture`, `PictureStorage`), contacts added with a code
  (`startContactAddition`, `finishContactAddition`), step-up (`startStepUp`, `finishStepUp`, `hasFreshStepUp`),
  two-factor (`startTotpSetup`, `confirmTotpSetup`, `removeTotp`, `totpStatus`, `regenerateRecoveryCodes`,
  `finishSecondFactor`, `encryptSecret`), devices (`listAccountSessions`, `endAccountSession`), activity
  (`listAccountActivity`), export (`exportAccount`) and deletion (`deleteAccount`); `sendCode`, `createTestPerson`;
- identifiers (no longer "usernames") in one table for everything that can have one; names; 6-digit codes; no code
  when the browser is already signed in to the contact's account; every id a UUIDv7 and every foreign key cascading
  (migration `0004-identifier-name-picture-second-factor`);

- identifiers (`checkIdentifier`, `identifierKey`);
- one-time codes (`createOneTimeCode`, `hashOneTimeCode`, `matchesOneTimeCode`);
- TOTP two-factor (`createTotpSecret`, `totpCode`, `verifyTotp`, `totpUri`), tested against the RFC 6238 vectors;
- base 32;
- recovery codes (`createRecoveryCodes`, `normalizeRecoveryCode`);
- email contacts (`normalizeEmail`, `emailLedgerForm`);
- effective permissions per application (`effectivePermissions`), where bans are exclusive roles;
- ban lengths from rule schedules (`banLength`);
- account storage in Postgres (`migrateAccount`, `AccountDatabase`, `createTestAccountDatabase`): applications,
  accounts, contacts and an append-only audit log, with the rules enforced by the database;
- `createPersonAccount`, `identifierAvailability`, `changeIdentifier`, `findAccountByContact`, `addContact`,
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
