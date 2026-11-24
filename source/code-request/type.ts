import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

/** What a one-time code is for; a code works only for its own purpose and request. */
export type CodePurpose = "sign-in" | "contact-verification" | "step-up";

export interface CodeRequestOptions {
  purpose: CodePurpose;
  contact: Contact;
  /** The account asking (step-up, contact verification). */
  accountId?: string;
  /** At least 32 characters, kept outside the database. */
  pepper: string;
  /** Digits (8 by default). */
  length?: number;
  /** 600 (10 minutes) by default. */
  lifetimeSeconds?: number;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export interface CodeRequest {
  requestId: string;
  /** Send it, then forget it: only its hash is stored. */
  code: string;
  contact: Contact;
  expiresAt: Date;
}
