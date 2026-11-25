import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** One of the account's authenticator apps (dates as ISO strings). */
export interface AuthenticatorMethod {
  id: string;
  /** Null when its owner gave it no name (it is then called by the day it was added). */
  name: string | null;
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
  start: () => Promise<AccountAnswer<{ id: string; qr: string; secret: string }>>;
  /** Turns it on with the code it shows, and the name typed (empty: none). */
  confirm: (id: string, code: string, name: string) => Promise<AccountAnswer>;
  /** An empty name takes its name away. */
  rename: (id: string, name: string) => Promise<AccountAnswer>;
  remove: (id: string) => Promise<AccountAnswer>;
  setRequired: (id: string, required: boolean) => Promise<AccountAnswer>;
  makeRecoveryCodes: () => Promise<AccountAnswer<{ recoveryCodes: string[] }>>;
}
