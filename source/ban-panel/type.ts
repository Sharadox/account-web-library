import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** One of the account's bans (dates as ISO strings). */
export interface BanRow {
  banId: string;
  /** The rule codes it broke. */
  rules: readonly string[];
  statement: string;
  endsAt: string | null;
  active: boolean;
  appeal: { text: string; decision: "upheld" | "shortened" | "lifted" | null; reasons: string | null } | null;
}

export interface BanPanelProperties {
  locale: AccountLocale;
  bans: readonly BanRow[];
  /** The public rules page, which bans link to. */
  rulesHref: string;
  appeal: (banId: string, text: string) => Promise<AccountAnswer>;
}
