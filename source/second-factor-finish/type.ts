export interface SecondFactorFinish {
  /** From `finishSignIn`'s `second-factor` answer. */
  ticket: string;
  /** The authenticator app's code, or a recovery code. */
  code: string;
  /** The client's IP address. */
  address: string;
  /** The browser's current session cookie, if any. */
  token: string | undefined;
  /** The browser's User-Agent, for the list of devices. */
  userAgent?: string | null;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type SecondFactorFinishResult =
  | { status: "signed-in"; accountId: string; token: string }
  | { status: "refused"; reason: "ticket" | "wrong" }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };
