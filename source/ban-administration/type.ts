import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface BanAdministrationProperties {
  locale: AccountLocale;
  /** Bans still active, newest first (dates as ISO strings). */
  /** Undefined while on its way: the panel shows at once, with skeletons where these will be. */
  bans?: readonly {
    banId: string;
    identifier: string;
    application: string | null;
    rules: readonly string[];
    statement: string;
    endsAt: string | null;
  }[];
}
