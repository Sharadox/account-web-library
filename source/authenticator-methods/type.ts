import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** One of the account's authenticator apps (dates as ISO strings). */
export interface AuthenticatorMethod {
  id: string;
  name: string;
  required: boolean;
  createdAt: string;
}

export interface AuthenticatorMethodsProperties {
  locale: AccountLocale;
  /** The company, as the authenticator app will show it. */
  company: string;
  authenticators: readonly AuthenticatorMethod[];
  /** How many recovery codes are left: with none, they're offered once an authenticator is on. */
  recoveryCodesLeft: number;
  /** `qr` is an image address (a data URL) of the otpauth link; `secret` the key to type in. */
  start: (name: string) => Promise<AccountAnswer<{ id: string; qr: string; secret: string }>>;
  confirm: (id: string, code: string) => Promise<AccountAnswer>;
  rename: (id: string, name: string) => Promise<AccountAnswer>;
  remove: (id: string) => Promise<AccountAnswer>;
  setRequired: (id: string, required: boolean) => Promise<AccountAnswer>;
  makeRecoveryCodes: () => Promise<AccountAnswer<{ recoveryCodes: string[] }>>;
}
