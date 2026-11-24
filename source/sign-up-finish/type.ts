import type { PersonAccountResult } from "@sharadox/account-web-library/person-account/type";

export interface SignUpFinish {
  /** From `finishSignIn`'s `sign-up` answer. */
  ticket: string;
  username: string;
  /** The browser's current session cookie, if any. */
  token: string | undefined;
  /** Milliseconds since 1970 (now by default). */
  now?: number;
}

export type SignUpFinishResult =
  | { status: "signed-in"; accountId: string; token: string }
  | { status: "refused"; reason: "ticket" | Extract<PersonAccountResult, { created: false }>["reason"] };
