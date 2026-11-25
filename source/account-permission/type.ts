export interface AccountPermissionQuestion {
  accountId: string;
  /** The application's key (`platform`). */
  application: string;
  /** The resource the action is on (`platform:project:42`), for roles limited to one. */
  resource?: string;
  /** A token's or key's scope: at most these. */
  scope?: string[];
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}
