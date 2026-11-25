import type { SignInProgress } from "@sharadox/account-web-library/sign-in-step/type";
import type { CodeVerificationResult } from "@sharadox/account-web-library/code-verification/type";

export interface SignInFinish {
  requestId: string;
  /** As typed. */
  code: string;
  /** The client's IP address. */
  address: string;
  /** The browser's current session cookie, if any: the account joins its accounts. */
  token: string | undefined;
  /** The browser's User-Agent, for the list of devices. */
  userAgent?: string | null;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

type Refusal = Extract<CodeVerificationResult, { valid: false }>["reason"];

export type SignInFinishResult =
  /** Signed in, or other required methods are left (`finishSignInStep`). */
  | SignInProgress
  /** No account has this contact yet: ask for an identifier, then `finishSignUp` with the ticket. */
  | { status: "sign-up"; ticket: string }
  | { status: "refused"; reason: Refusal }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };
