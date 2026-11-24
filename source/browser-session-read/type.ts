/** An account signed in on the browser, as the account selector shows it. */
export interface SignedInAccount {
  accountSessionId: string;
  accountId: string;
  /** Without the `@`. */
  identifier: string;
  name: string;
  /** The picture's id (its file's name in storage); null without one. */
  pictureId: string | null;
  signedInAt: Date;
  secondFactorAt: Date | null;
}

export interface BrowserSession {
  browserSessionId: string;
  /** In the order they signed in. */
  accounts: SignedInAccount[];
}
