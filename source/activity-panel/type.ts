import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface ActivityPanelProperties {
  locale: AccountLocale;
  /** Newest first (dates as ISO strings). */
  /** Undefined while on its way: the panel shows at once, with skeletons where these will be. */
  activity?: readonly { id: string; at: string; action: string }[];
}
