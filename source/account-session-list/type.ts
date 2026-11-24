/** One device (browser) the account is signed in on. */
export interface AccountDevice {
  accountSessionId: string;
  /** The browser's description when it signed in; null when unknown. */
  userAgent: string | null;
  signedInAt: Date;
  lastSeenAt: Date;
  /** Whether two-factor was passed in this session. */
  secondFactor: boolean;
  /** Whether it is the browser asking. */
  current: boolean;
}
