/** An account signed in on the browser, as the account selector shows it. */
export interface SignedInAccount {
  accountSessionId: string;
  accountId: string;
  username: string;
  signedInAt: Date;
  secondFactorAt: Date | null;
}

export interface BrowserSession {
  browserSessionId: string;
  /** In the order they signed in. */
  accounts: SignedInAccount[];
}
