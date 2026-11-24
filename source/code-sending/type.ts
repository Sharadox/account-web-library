import type { CodePurpose } from "@sharadox/account-web-library/code-request/type";
import type { ContactChannel } from "@sharadox/account-web-library/contact-channel/type";
import type { Contact } from "@sharadox/account-web-library/contact-kind/type";

export interface CodeSending {
  purpose: CodePurpose;
  /** Already normalized. */
  contact: Contact;
  channel: ContactChannel;
  /** The account asking (step-up, contact verification); null when signing in. */
  accountId?: string | null;
  /** The client's IP address. */
  address: string;
  /** For the code's message. */
  language: string;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type CodeSendingResult =
  | {
      status: "sent";
      requestId: string;
      /** Sends the code: call it after answering (Next.js `after()`), so the answer's timing reveals nothing. */
      deliver: () => Promise<void>;
    }
  | { status: "refused"; reason: "unavailable" }
  | { status: "refused"; reason: "rate-limit"; retryAfterSeconds: number };
