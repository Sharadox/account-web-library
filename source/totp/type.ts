/** Code length (6, what authenticator apps show) and step length in seconds (30). */
export interface TotpOptions {
  digits?: number;
  period?: number;
}

/** Verification also takes the step of the last accepted code, so it can't be used twice. */
export interface VerifyTotpOptions extends TotpOptions {
  lastUsedStep?: number;
}

/** A valid code (store `step` as the new last used step), or not. */
export type TotpVerification = { valid: true; step: number } | { valid: false };

/** What the otpauth address shows in the authenticator app. */
export interface TotpUriOptions {
  /** The company, shown above the code. */
  issuer: string;
  /** Which account: the identifier. */
  account: string;
  secret: Uint8Array;
}
