import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** One of the account's emails. */
export interface EmailMethod {
  id: string;
  value: string;
  verified: boolean;
  /** Asked for at every sign-in. */
  required: boolean;
}

export interface EmailMethodsProperties {
  locale: AccountLocale;
  /** While on their way, a skeleton (and Add waits). */
  emails?: readonly EmailMethod[];
  add: (email: string) => Promise<AccountAnswer<{ requestId: string }>>;
  /** Verifies the new email with its code; `required`: asked for at every sign-in from then on. */
  verify: (requestId: string, code: string, required: boolean) => Promise<AccountAnswer>;
  remove: (id: string) => Promise<AccountAnswer>;
  setRequired: (id: string, required: boolean) => Promise<AccountAnswer>;
}
