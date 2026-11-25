import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";
import type { NotificationPreference } from "@sharadox/account-web-library/notification-preference/type";

export interface PreferencePanelProperties {
  locale: AccountLocale;
  preferences: readonly NotificationPreference[];
  /** Saves every choice at once. */
  save: (choices: { kind: string; channel: "in-app" | "email"; enabled: boolean }[]) => Promise<AccountAnswer>;
}
