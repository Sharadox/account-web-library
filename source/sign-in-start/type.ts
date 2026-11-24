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
  | { status: "refused"; reason: "proof" | "contact" | "unavailable" }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };
