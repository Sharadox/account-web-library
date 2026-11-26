import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface NamePanelProperties {
  locale: AccountLocale;
  /** The account's name; while on its way, a skeleton (and Edit waits). */
  name?: string;
  change: (name: string) => Promise<AccountAnswer>;
}
