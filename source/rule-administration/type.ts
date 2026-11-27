import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface RuleAdministrationProperties {
  locale: AccountLocale;
  /** The rules in force, as the public page shows them. */
  /** Undefined while on its way: the panel shows at once, with skeletons where these will be. */
  rules?: readonly { application: string | null; code: string; title: string; penalties: readonly string[] }[];
  /** The public rules page. */
  rulesHref: string;
}
