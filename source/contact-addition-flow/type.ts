import type { CodeSendingResult } from "@sharadox/account-web-library/code-sending/type";
import type { CodeVerificationResult } from "@sharadox/account-web-library/code-verification/type";

export type ContactAdditionStart =
  | (Extract<CodeSendingResult, { status: "sent" }> & { contactId: string })
  | Exclude<CodeSendingResult, { status: "sent" }>
  | { status: "refused"; reason: "contact" | "already-added" | "contact-taken" | "contact-banned" | "no-account" };

export type ContactAdditionFinish =
  /** `notify` tells the account's other contacts (call it after answering). */
  | { status: "verified"; contactId: string; notify: () => Promise<void> }
  | {
      status: "refused";
      reason: Extract<CodeVerificationResult, { valid: false }>["reason"] | "no-contact" | "contact-taken";
    };
