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

/** Something the account's owner must know, sent to each of its contacts. */
export type Notice =
  /** The account will be deleted for not being used (2 years without signing in). */
  | { kind: "inactivity-warning"; deletionAt: Date }
  /** Another email was added to the account. */
  | { kind: "contact-added"; contact: string }
  /** A recovery code was used to sign in. */
  | { kind: "recovery-code-used" };

export interface NoticeDelivery {
  contact: Contact;
  /** The reader's language; channels fall back to English. */
  language: string;
  notice: Notice;
}

/**
 * How codes reach one kind of contact (email now; phone, WhatsApp, Messenger, Instagram later). Cap the sends of paid
 * channels before calling `send` (protection-web-library's `spendFromCap`).
 */
export interface ContactChannel {
  kind: string;
  send(delivery: CodeDelivery): Promise<void>;
  /** Sends a notice; a channel without it can't carry notices. */
  notify?(delivery: NoticeDelivery): Promise<void>;
}
