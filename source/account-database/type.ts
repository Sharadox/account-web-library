import type { ProtectionDatabase } from "@sharadox/protection-web-library/protection-database/type";
import type { ColumnType, Generated } from "kysely";

/** A timestamp the database fills in when not given. */
type DefaultTime = ColumnType<Date, Date | undefined, Date>;

/** An application the accounts sign in to (`account` itself, `platform`, `shop`…). */
export interface ApplicationTable {
  /** UUIDv7. */
  id: Generated<string>;
  /** Its permanent short name, the prefix of its permissions (`account`, `platform`). */
  key: string;
  name: string;
  created_at: DefaultTime;
}

/** A person, or an agent owned by a person. */
export interface AccountTable {
  id: string;
  kind: "person" | "agent";
  /** The person's or agent's name, 1 to 50 characters. */
  name: string;
  /** The person who owns an agent; null for people. */
  owner_id: string | null;
  created_at: DefaultTime;
  last_active_at: DefaultTime;
  /** The language its notices are written in (`pt-PT`); English when null. */
  language: ColumnType<string | null, string | null | undefined, string | null>;
}

/** A way to reach an account (email now; phone and messaging later). */
export interface ContactTable {
  id: string;
  account_id: string;
  kind: string;
  /** Normalized (see `normalizeContact`). */
  value: string;
  /** When a one-time code proved it; null until then. A verified contact belongs to one account only. */
  verified_at: Date | null;
  /** Whether codes for signing in may be sent to it. */
  sign_in: Generated<boolean>;
  created_at: DefaultTime;
}

/** One line of the append-only audit log. */
export interface AuditEventTable {
  id: string;
  at: DefaultTime;
  /** The account it is about (kept after the account is deleted, as a bare id). */
  account_id: string | null;
  /** Who did it, when not the account itself (an administrator, an agent). */
  actor_account_id: string | null;
  /** The application it happened in; null for the account system as a whole. */
  application_id: string | null;
  action: string;
  detail: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, never>;
}

/** A one-time code sent to a contact, stored only as an HMAC bound to its purpose and request. */
export interface CodeRequestTable {
  id: string;
  /** `sign-in`, `contact-verification` or `step-up`. */
  purpose: string;
  /** The account asking (step-up, contact verification); null when signing in. */
  account_id: string | null;
  kind: string;
  value: string;
  code_hash: string;
  created_at: Date;
  expires_at: Date;
  attempts: Generated<number>;
  /** When the right code came back. */
  used_at: Date | null;
  /** When a newer request for the same contact and purpose replaced it. */
  voided_at: Date | null;
}

/**
 * A unique name to reference something by (`@luis-pires`): one namespace for accounts now and organizations later,
 * unique without regard to case. Stored without the `@`.
 */
export interface IdentifierTable {
  id: string;
  /** Shown as written. */
  value: string;
  /** The account it names (exactly one owner per identifier). */
  account_id: string | null;
  created_at: DefaultTime;
}

/** An account's picture: the file itself is in object storage, under its id. */
export interface AccountPictureTable {
  id: string;
  account_id: string;
  content_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "image/avif" | "image/svg+xml";
  byte_size: number;
  width: number;
  height: number;
  created_at: DefaultTime;
}

/** An authenticator app (TOTP) for two-factor, its secret encrypted with a key outside the database. */
export interface TotpCredentialTable {
  id: string;
  account_id: string;
  secret_ciphertext: string;
  /** The last 30-second step accepted, so a code can't be replayed. */
  last_used_step: ColumnType<string | null, number | string | null | undefined, number | string | null>;
  created_at: DefaultTime;
  /** When the first correct code turned it on; null while it is being set up. */
  confirmed_at: Date | null;
}

/** A single-use recovery code, stored only as an HMAC. */
export interface RecoveryCodeTable {
  id: string;
  account_id: string;
  code_hash: string;
  created_at: DefaultTime;
  used_at: Date | null;
}

/** One browser (the account site's cookie holds its token; only the token's hash is stored). */
export interface BrowserSessionTable {
  id: string;
  token_hash: string;
  /** The browser's description (its User-Agent, at most 500 characters), for the list of devices. */
  user_agent: ColumnType<string | null, string | null | undefined, string | null>;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
}

/** One account signed in on one browser: a browser can hold any number of them (the account selector). */
export interface AccountSessionTable {
  id: string;
  browser_session_id: string;
  account_id: string;
  created_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  /** When two-factor was last passed in this session; null without it. */
  second_factor_at: Date | null;
  /** When a fresh code last confirmed it is really them, for sensitive changes (`step-up`). */
  step_up_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
}

/** Something an account may do in one application (`platform.job.read`); declared by the application. */
export interface PermissionTable {
  id: string;
  application_id: string;
  /** Starts with the application's key. */
  key: string;
  description: Generated<string>;
  created_at: DefaultTime;
}

/** A set of permissions in one application (or every one: `application_id` null). */
export interface RoleTable {
  id: string;
  application_id: string | null;
  key: string;
  name: string;
  /** While granted, the account has only this role's permissions there (how bans work). */
  exclusive: Generated<boolean>;
  /** Every account holds its application's default role, without a grant. */
  is_default: Generated<boolean>;
  created_at: DefaultTime;
}

export interface RolePermissionTable {
  id: string;
  role_id: string;
  permission_id: string;
}

/** A role given to an account, maybe for one resource, from a moment until another (or for good). */
export interface RoleGrantTable {
  id: string;
  account_id: string;
  role_id: string;
  /** `platform:project:42`; null for the whole application. */
  resource: string | null;
  starts_at: DefaultTime;
  ends_at: Date | null;
  source: "manual" | "membership" | "ban" | "system";
  /** Who gave it; null for the system, or once that account is gone. */
  granted_by: string | null;
  reason: string | null;
  created_at: DefaultTime;
}

/** Words in each language (`{ en, pt }`). */
type Words = Record<string, string>;

/** One version of a public rule, with its penalties for the 1st, 2nd… offense (seconds, or "permanent"). */
export interface RuleTable {
  id: string;
  /** Null for every application. */
  application_id: string | null;
  code: string;
  version: number;
  title: ColumnType<Words, Words | string, Words | string>;
  description: ColumnType<Words, Words | string, Words | string>;
  schedule: ColumnType<(number | "permanent")[], (number | "permanent")[] | string, (number | "permanent")[] | string>;
  created_at: DefaultTime;
}

/** A ban: the exclusive grant it made, its statement of reasons, and how its length was reached. */
export interface BanTable {
  id: string;
  grant_id: string;
  account_id: string;
  statement: string;
  evidence: string | null;
  /** Seconds, or "permanent". */
  penalty: string;
  created_by: string | null;
  created_at: DefaultTime;
}

/** A rule version a ban cites. */
export interface BanRuleTable {
  id: string;
  ban_id: string;
  rule_id: string;
}

/** The one appeal a ban may have, and its decision. */
export interface AppealTable {
  id: string;
  ban_id: string;
  text: string;
  created_at: DefaultTime;
  decision: "upheld" | "shortened" | "lifted" | null;
  reasons: string | null;
  decided_by: string | null;
  decided_at: Date | null;
}

/** A banned account's contact, kept (as an HMAC only) after the account is deleted, until the ban ends. */
export interface BannedContactTable {
  id: string;
  contact_hash: string;
  application_id: string | null;
  ends_at: Date | null;
  rule_codes: string[];
  created_at: DefaultTime;
}

/** An inactivity warning sent, for one period of inactivity (from `active_at`). */
export interface InactivityWarningTable {
  id: string;
  account_id: string;
  stage: "6-months" | "3-months" | "1-month" | "1-week" | "1-day";
  /** The `last_active_at` it counted from: signing in starts a new period. */
  active_at: Date;
  sent_at: DefaultTime;
}

/** The tables `migrateAccount` creates, for typing a Kysely instance. */
export interface AccountDatabase {
  application: ApplicationTable;
  account: AccountTable;
  contact: ContactTable;
  audit_event: AuditEventTable;
  code_request: CodeRequestTable;
  browser_session: BrowserSessionTable;
  account_session: AccountSessionTable;
  identifier: IdentifierTable;
  account_picture: AccountPictureTable;
  totp_credential: TotpCredentialTable;
  recovery_code: RecoveryCodeTable;
  permission: PermissionTable;
  role: RoleTable;
  role_permission: RolePermissionTable;
  role_grant: RoleGrantTable;
  rule: RuleTable;
  ban: BanTable;
  ban_rule: BanRuleTable;
  appeal: AppealTable;
  banned_contact: BannedContactTable;
  inactivity_warning: InactivityWarningTable;
}

/** The account tables and the protection tables (rate limits, spending caps, used challenges) the server needs. */
export type AccountServerDatabase = AccountDatabase & ProtectionDatabase;
