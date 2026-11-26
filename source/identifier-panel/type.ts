import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface IdentifierPanelProperties {
  locale: AccountLocale;
  /** Without the `@`; while on its way, a skeleton (and Edit waits). */
  identifier?: string;
  change: (identifier: string) => Promise<AccountAnswer>;
}
