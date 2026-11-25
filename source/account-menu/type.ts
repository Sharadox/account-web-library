import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** An account as the menu shows it. */
export interface MenuAccount {
  accountId: string;
  name: string;
  /** Without the `@`. */
  identifier: string;
  pictureUrl: string | null;
}

/** Who is signed in on this browser, for the site's bar. */
export interface SignedInAccounts {
  /** The account in use. */
  current: MenuAccount & {
    /** The names of its roles now (shown as chips). */
    roles: readonly string[];
  };
  /** The browser's other signed-in accounts. */
  others: readonly MenuAccount[];
  /** The account settings. */
  settingsHref: string;
  /** Signing in another account. */
  signInHref: string;
  /** The administration, for accounts allowed to see it. */
  administrationHref?: string;
  /** The server action that makes the form's `account` the one in use. */
  switchAccount: (form: FormData) => Promise<void>;
  /** The server action that signs out the form's `account`, or every account when it's empty. */
  signOut: (form: FormData) => Promise<void>;
}

export interface AccountMenuProperties extends SignedInAccounts {
  locale: AccountLocale;
}
