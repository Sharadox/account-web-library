/** One thing that happened to the account, as its owner sees it. */
export interface AccountActivityEvent {
  id: string;
  at: Date;
  /** `account.created`, `session.signed-in`, `contact.added`… */
  action: string;
  /** Ids and kinds, never contact values or secrets. */
  detail: Record<string, unknown>;
}

export interface AccountActivityPage {
  events: AccountActivityEvent[];
  /** Pass as `before` for the next page; null when there are no more. */
  next: string | null;
}
