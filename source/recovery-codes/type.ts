import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

export interface RecoveryCodeListProperties {
  locale: AccountLocale;
  codes: readonly string[];
}

export interface RecoveryCodesProperties {
  locale: AccountLocale;
  /** Whether the account has an authenticator on (recovery codes stand in for one). */
  authenticators: boolean;
  left: number;
  make: () => Promise<AccountAnswer<{ recoveryCodes: string[] }>>;
}
