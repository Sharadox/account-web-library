import type { CodePurpose } from "@sharadox/account-web-library/code-request/type";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

/** A one-time code to deliver to a contact. */
export interface CodeDelivery {
  contact: Contact;
  code: string;
  purpose: CodePurpose;
  /** The reader's language (`en`, `pt-PT`…); channels fall back to English. */
  language: string;
  expiresAt: Date;
}

/**
 * How codes reach one kind of contact (email now; phone, WhatsApp, Messenger, Instagram later). Cap the sends of paid
 * channels before calling `send` (protection-web-library's `spendFromCap`).
 */
export interface ContactChannel {
  kind: string;
  send(delivery: CodeDelivery): Promise<void>;
}
