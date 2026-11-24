/** What happened, to which account, done by whom, in which application. */
export interface AuditEvent {
  /** The account it is about. */
  accountId?: string | null;
  /** Who did it, when not the account itself. */
  actorAccountId?: string | null;
  application?: string | null;
  /** `<subject>.<verb>`: `account.created`, `contact.removed`, `role.granted`… */
  action: string;
  /** Ids and kinds, never contact values or secrets. */
  detail?: Record<string, unknown>;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}
