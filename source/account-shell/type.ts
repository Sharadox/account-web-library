import type { ReactNode } from "react";
import type { AccountArea } from "@sharadox/account-web-library/account-area/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface AccountShellProperties {
  locale: AccountLocale;
  /** From `accountAreas`. */
  areas: AccountArea[];
  /** The area's page: its sections (`AccountSection`), one under another. */
  children: ReactNode;
}
