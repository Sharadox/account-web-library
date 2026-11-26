import type { MethodChoice } from "@sharadox/account-web-library/authentication-method/type";
import type { CodeSendingResult } from "@sharadox/account-web-library/code-sending/type";
import type { CodeVerificationResult } from "@sharadox/account-web-library/code-verification/type";

/**
 * The ways an account can confirm it is them: with required methods, every one of them (`all`); otherwise any one
 * of its methods (`one`). Emails are shown in full (`hint`): it is their owner asking. `recoveryCode`: the account
 * has one, which confirms at once.
 */
export interface StepUpMethods {
  ticket: string;
  mode: "all" | "one";
  methods: MethodChoice[];
  recoveryCode: boolean;
}

export type StepUpStart = CodeSendingResult | { status: "refused"; reason: "contact" };

/** One way to confirm: an emailed code (`startStepUp`), an authenticator's code, or a recovery code. */
export type StepUpStep =
  | { kind: "email"; requestId: string; code: string }
  | { kind: "authenticator"; id: string; code: string }
  | { kind: "recovery-code"; code: string };

export type StepUpFinish =
  /** `notify`, after a recovery code: tells every contact; call it after answering. */
  | { status: "confirmed"; notify?: () => Promise<void> }
  /** Required methods are `left` (their ids): the next step goes with this ticket. */
  | { status: "more"; ticket: string; left: string[] }
  | {
      status: "refused";
      reason: Extract<CodeVerificationResult, { valid: false }>["reason"] | "session" | "ticket" | "method";
    }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };
