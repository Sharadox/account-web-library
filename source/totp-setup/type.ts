export type TotpSetupStart =
  /** Show `uri` as a QR code, and `secret` (base 32) for typing in by hand; confirm with `id`. */
  | { status: "started"; id: string; uri: string; secret: string }
  /** `name`: over 50 characters once trimmed. */
  | { status: "name" | "no-account" };

export type TotpSetupConfirmation =
  /** The authenticator is on: offer recovery codes (recommended), never make them unasked. */
  { confirmed: true } | { confirmed: false; reason: "wrong" | "none" | "name" };

export type TotpRename = { renamed: true } | { renamed: false; reason: "name" | "none" };

/** One authenticator app that is on. */
export interface Authenticator {
  id: string;
  /** Null when its owner gave it no name. */
  name: string | null;
  /** Whether every sign-in asks for its code. */
  required: boolean;
  createdAt: Date;
}

export interface TotpStatus {
  authenticators: Authenticator[];
  recoveryCodesLeft: number;
}
