import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

export interface PersonAccountRequest {
  /** What the account shows (`checkAccountName`). */
  name: string;
  /** Without the `@` (`checkIdentifier`). */
  identifier: string;
  /** Already proved by a one-time code: it is stored verified. */
  contact: Contact;
  /** The person's language, for notices (`pt-PT`); English without it. */
  language?: string;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type PersonAccountResult =
  | { created: true; accountId: string; contactId: string }
  | { created: false; reason: "name-invalid" | "identifier-invalid" | "identifier-taken" | "contact-taken" };
