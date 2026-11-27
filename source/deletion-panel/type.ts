import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface DeletionPanelProperties {
  locale: AccountLocale;
  /** Typed to confirm, without the `@`. */
  /** Undefined while on its way: the card shows at once, and Delete waits for it. */
  identifier?: string;
  /** Deletes the account and leaves the page (the server action redirects). */
  remove: () => Promise<AccountAnswer>;
}
