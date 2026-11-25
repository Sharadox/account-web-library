import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** A browser where the account is signed in (dates as ISO strings). */
export interface DeviceRow {
  accountSessionId: string;
  userAgent: string | null;
  signedInAt: string;
  lastSeenAt: string;
  /** Signed in with more than one method. */
  secondFactor: boolean;
  /** This browser. */
  current: boolean;
}

export interface DevicePanelProperties {
  locale: AccountLocale;
  devices: readonly DeviceRow[];
  end: (accountSessionId: string) => Promise<AccountAnswer>;
}
