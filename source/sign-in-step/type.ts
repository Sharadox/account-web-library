import type { Solution } from "@sharadox/protection-web-library/proof-of-work/type";
import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import type { CodeVerificationResult } from "@sharadox/account-web-library/code-verification/type";

/** Where a sign-in stands after a method passed. */
export type SignInProgress =
  /** `notify`, after a recovery code or on a browser new to the account system: call it after answering. */
  | { status: "signed-in"; accountId: string; token: string; notify?: () => Promise<void> }
  /**
   * Required methods are left: ask for one of `methods` (all of them, one after another), then `finishSignInStep`
   * with the ticket. `recoveryCode`: a recovery code may stand in for an authenticator.
   */
  | { status: "more"; ticket: string; methods: MethodChoice[]; recoveryCode: boolean };

type Refusal = Extract<CodeVerificationResult, { valid: false }>["reason"];

export type SignInStepResult =
  | SignInProgress
  /** Signing in with an identifier: the account's ways in; any one starts (then the required ones). */
  | { status: "choose"; ticket: string; methods: MethodChoice[]; recoveryCode: boolean }
  /** `method`: not one of the account's methods left to pass. */
  | { status: "refused"; reason: "ticket" | "wrong" | "method" | "proof" | "unknown" | Refusal }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };

export interface IdentifierSignInStart {
  /** As typed, without the "@". */
  identifier: string;
  /** The browser's answer to `issueChallenge`. */
  solution: Solution;
  /** The client's IP address. */
  address: string;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export interface SignInStepCodeSending {
  ticket: string;
  /** One of the account's emails, from the methods given. */
  contactId: string;
  address: string;
  /** For the code's message. */
  language: string;
  now?: number;
}

export interface SignInStepFinish {
  ticket: string;
  step:
    | { kind: "email"; requestId: string; code: string }
    | { kind: "authenticator"; id: string; code: string }
    | { kind: "recovery-code"; code: string };
  /** The client's IP address. */
  address: string;
  /** The browser's current session cookie, if any. */
  token: string | undefined;
  /** The browser's User-Agent, for the list of devices. */
  userAgent?: string | null;
  now?: number;
}
