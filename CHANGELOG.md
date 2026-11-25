# Changelog

What changed in each version of `@sharadox/account-web-library`, newest first.

## 0.1.0

First building blocks:

- a jump to a section holds it in place while the sections above it fill in, until the reader scrolls;

- the generic pieces (button, card, code boxes, copy button, dialog, pending mark, skeleton, switch, text field, tip,
  notifications) now come from `@sharadox/interface-web-library`; `AccountTheme` dresses them too (`AccountThemeValues`
  is its `InterfaceThemeValues`);

- the overview takes the whole width (the side menu's column only when there is a side menu); a chosen or removed picture, a notification marked read or deleted show at once and go back if refused; a device being signed out shows its loader;

- screens that never wait: each area is one page whose side menu jumps to its sections (`AccountShell` sits in a
  layout and stays between areas, `AccountSection`), switches flip at once and saved values show at once with a
  loader (`PendingMark`), going back if refused, loaders shaped like what comes (`Skeleton` shapes), the code pop-up
  centered with a countdown to its expiry, then Send a new code or Cancel; Cancel instead of Discard; Title Case titles;
  a new overview; switching accounts stays on the page; an email can be required as it is added; authenticators show
  their QR code at once, the key on request, and an optional name (migration `0009-optional-authenticator-name`);
  every code comes in one email, "Account · Authentication Code"; field and label theme values; `SignInScreen` can sit in
  the site's own card;

- the account screens, for every company: the application layout (areas and sections), sign-in and sign-up, every settings panel, the administration, the menu with role chips and switching, the notification bell, notifications after every action, and the pieces they share (`AccountTheme` for a company's look);

- authentication methods: any number of named authenticators, any email or authenticator required at every sign-in (`authentication-method`, `sign-in-step` with identifier sign-in; `second-factor-finish` is gone); recovery codes offered, never made unasked; notifications in an inbox and by email per the owner's choices (`notification-inbox`, `notification-preference`, `notice-kind`); optional birthdays (`account-birthday`, 16 or older with a year); `deleteRole` (a deleted role leaves its holders); `runAccountMaintenance` keeping a year of audit log and notifications; subjects "Account · …" and codes in boxes; a used code request forgets its address (migration `0008-method-notification-birthday`);

- the account system's own application (`ACCOUNT_APPLICATION`) and `setUpAccountSystem`;

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
