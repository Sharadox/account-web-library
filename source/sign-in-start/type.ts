import type { Solution } from "@sharadox/protection-web-library/proof-of-work/type";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

export interface SignInStart {
  contact: Contact;
  /** The browser's answer to `issueChallenge`. */
  solution: Solution;
  /** The client's IP address (web-library's `clientAddress`). */
  address: string;
  /** For the code's message. */
  language: string;
  /** The browser's session cookie, if any: a contact of an account already signed in there gets no code. */
  token?: string | undefined;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type SignInStartResult =
  | {
      status: "sent";
      requestId: string;
      /** Sends the code: call it after answering (Next.js `after()`), so the answer's timing reveals nothing. */
      deliver: () => Promise<void>;
    }
  /** The browser is already signed in to the account with this verified contact: nothing was sent. */
  | { status: "signed-in"; accountId: string }
  | { status: "refused"; reason: "proof" | "contact" | "unavailable" }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };
