import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface BirthdayPanelProperties {
  locale: AccountLocale;
  birthday: { day: number; month: number; year: number | null } | null;
  /** Null clears it. */
  save: (birthday: { day: number; month: number; year: number | null } | null) => Promise<AccountAnswer>;
}
