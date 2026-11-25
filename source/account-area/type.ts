import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** The account site's main areas, in the order of its menu. */
export type AccountAreaKey = "overview" | "profile" | "security" | "notifications" | "privacy" | "administration";

/** One area with its sections, as links. */
export interface AccountArea {
  key: AccountAreaKey;
  label: string;
  href: string;
  sections: { key: string; label: string; href: string }[];
}

export interface AccountAreaOptions {
  locale: AccountLocale;
  /** Whether the reader may see the administration. */
  administrator: boolean;
}
