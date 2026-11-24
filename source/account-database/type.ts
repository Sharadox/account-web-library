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
}

/** The account tables and the protection tables (rate limits, spending caps, used challenges) the server needs. */
export type AccountServerDatabase = AccountDatabase & ProtectionDatabase;
