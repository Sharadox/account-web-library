import type { ReactNode } from "react";
import type { AccountArea, AccountAreaKey } from "@sharadox/account-web-library/account-area/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface AccountShellProperties {
  locale: AccountLocale;
  /** From `accountAreas`. */
  areas: AccountArea[];
  area: AccountAreaKey;
  section: string;
  /** The page's heading (the section's name by default). */
  title?: string;
  /** A line under the heading. */
  description?: string;
  children: ReactNode;
}
