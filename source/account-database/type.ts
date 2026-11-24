import type { ColumnType, Generated } from "kysely";

/** A timestamp the database fills in when not given. */
type DefaultTime = ColumnType<Date, Date | undefined, Date>;

/** An application the accounts sign in to (`account` itself, `platform`, `shop`…). */
export interface ApplicationTable {
  id: string;
  name: string;
  created_at: DefaultTime;
}

/** A person, or an agent owned by a person. */
export interface AccountTable {
  id: string;
  kind: "person" | "agent";
  /** Shown as written; unique without regard to case. */
  username: string;
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
  application: string | null;
  action: string;
  detail: ColumnType<Record<string, unknown>, Record<string, unknown> | undefined, never>;
}

/** The tables `migrateAccount` creates, for typing a Kysely instance. */
export interface AccountDatabase {
  application: ApplicationTable;
  account: AccountTable;
  contact: ContactTable;
  audit_event: AuditEventTable;
}
