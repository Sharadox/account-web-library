import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface IdentityPanelProperties {
  locale: AccountLocale;
  name: string;
  /** Without the `@`. */
  identifier: string;
  changeName: (name: string) => Promise<AccountAnswer>;
  changeIdentifier: (identifier: string) => Promise<AccountAnswer>;
}
