import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

export interface ContactAdditionRequest {
  accountId: string;
  contact: Contact;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type ContactAdditionResult =
  { added: true; contactId: string } | { added: false; reason: "already-added" | "contact-taken" | "no-account" };
