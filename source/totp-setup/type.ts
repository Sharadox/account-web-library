export type TotpSetupStart =
  /** Show `uri` as a QR code, and `secret` (base 32) for typing in by hand. */
  { status: "started"; uri: string; secret: string } | { status: "already-on" | "no-account" };

export type TotpSetupConfirmation =
  /** Two-factor is on: show the recovery codes once, and recommend keeping them somewhere safe. */
  { confirmed: true; recoveryCodes: string[] } | { confirmed: false; reason: "wrong" | "none" };

export interface TotpStatus {
  /** Whether an authenticator app is needed to sign in. */
  on: boolean;
  recoveryCodesLeft: number;
}
