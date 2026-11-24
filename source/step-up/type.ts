import type { CodeSendingResult } from "@sharadox/account-web-library/code-sending/type";
import type { CodeVerificationResult } from "@sharadox/account-web-library/code-verification/type";

export type StepUpStart = CodeSendingResult | { status: "refused"; reason: "contact" };

export type StepUpFinish =
  | { status: "confirmed" }
  | { status: "refused"; reason: Extract<CodeVerificationResult, { valid: false }>["reason"] | "session" };
