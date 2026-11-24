import type { CodeSendingResult } from "@sharadox/account-web-library/code-sending/type";
import type { CodeVerificationResult } from "@sharadox/account-web-library/code-verification/type";

export type ContactAdditionStart =
  | (Extract<CodeSendingResult, { status: "sent" }> & { contactId: string })
  | Exclude<CodeSendingResult, { status: "sent" }>
  | { status: "refused"; reason: "contact" | "already-added" | "contact-taken" | "no-account" };

export type ContactAdditionFinish =
  | { status: "verified"; contactId: string }
  | {
      status: "refused";
      reason: Extract<CodeVerificationResult, { valid: false }>["reason"] | "no-contact" | "contact-taken";
    };
