import type { CodePurpose } from "@sharadox/account-web-library/code-request/type";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

export interface CodeVerificationOptions {
  requestId: string;
  /** As typed: spaces are ignored. */
  code: string;
  purpose: CodePurpose;
  pepper: string;
  /** Wrong codes allowed before the request is dead (5 by default). */
  maximumAttempts?: number;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type CodeVerificationResult =
  | { valid: true; contact: Contact; accountId: string | null }
  | { valid: false; reason: "unknown" | "used" | "replaced" | "expired" | "attempts" | "wrong" };
