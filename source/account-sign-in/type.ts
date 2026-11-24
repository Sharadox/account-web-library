export interface SignInOptions {
  accountId: string;
  /** The browser's current token (its cookie), if it has one: the account joins that browser's accounts. */
  token?: string;
  /** Whether two-factor was passed for this sign-in. */
  secondFactor?: boolean;
  /** 30 days by default. */
  accountSessionSeconds?: number;
  /** 400 days by default (the longest a browser keeps a cookie). */
  browserSessionSeconds?: number;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export interface SignInResult {
  /** The browser's new token: set it as the cookie (it replaces the old one at every sign-in). */
  token: string;
  browserSessionId: string;
  accountSessionId: string;
}
