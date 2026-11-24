import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

export interface PersonAccountRequest {
  username: string;
  /** Already proved by a one-time code: it is stored verified. */
  contact: Contact;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type PersonAccountResult =
  | { created: true; accountId: string; contactId: string }
  | { created: false; reason: "username-invalid" | "username-taken" | "contact-taken" };
