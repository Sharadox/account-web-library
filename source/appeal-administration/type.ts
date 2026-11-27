import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface AppealAdministrationProperties {
  locale: AccountLocale;
  /** Appeals waiting for a decision (dates as ISO strings). */
  /** Undefined while on its way: the panel shows at once, with skeletons where these will be. */
  appeals?: readonly { appealId: string; identifier: string; statement: string; text: string; createdAt: string }[];
  decide: (input: {
    appealId: string;
    decision: "upheld" | "shortened" | "lifted";
    reasons: string;
    /** ISO date, to shorten to. */
    endsAt?: string;
  }) => Promise<AccountAnswer>;
}
