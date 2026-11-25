export interface SignInOptions {
  accountId: string;
  /** The browser's current token (its cookie), if it has one: the account joins that browser's accounts. */
  token?: string;
  /** Whether two-factor was passed for this sign-in. */
  secondFactor?: boolean;
  /** The browser's User-Agent, shown in the list of devices (kept to 500 characters). */
  userAgent?: string | null;
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
  /** Whether the browser had no session before (tell the account's emails: someone signed in somewhere new). */
  newBrowser: boolean;
}
