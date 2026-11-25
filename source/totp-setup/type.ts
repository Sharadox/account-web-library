export type TotpSetupStart =
  /** Show `uri` as a QR code, and `secret` (base 32) for typing in by hand; confirm with `id`. */
  | { status: "started"; id: string; uri: string; secret: string }
  /** `name`: not 1 to 50 characters once trimmed. */
  | { status: "name" | "no-account" };

export type TotpSetupConfirmation =
  /** The authenticator is on: offer recovery codes (recommended), never make them unasked. */
  { confirmed: true } | { confirmed: false; reason: "wrong" | "none" };

export type TotpRename = { renamed: true } | { renamed: false; reason: "name" | "none" };

/** One authenticator app that is on. */
export interface Authenticator {
  id: string;
  name: string;
  /** Whether every sign-in asks for its code. */
  required: boolean;
  createdAt: Date;
}

export interface TotpStatus {
  authenticators: Authenticator[];
  recoveryCodesLeft: number;
}
