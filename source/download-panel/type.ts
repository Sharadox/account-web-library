import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface DownloadPanelProperties {
  locale: AccountLocale;
  /** The route that answers with the account's data as a JSON file. */
  href: string;
}
