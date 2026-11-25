import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface ActivityPanelProperties {
  locale: AccountLocale;
  /** Newest first (dates as ISO strings). */
  activity: readonly { id: string; at: string; action: string }[];
}
