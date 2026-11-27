import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** An account as the administration sees it (dates as ISO strings). */
export interface AdministeredAccount {
  account: { accountId: string; name: string; identifier: string; pictureUrl: string | null };
  grants: readonly {
    grantId: string;
    application: string | null;
    roleName: string;
    resource: string | null;
    endsAt: string | null;
    active: boolean;
  }[];
  bans: readonly {
    banId: string;
    application: string | null;
    rules: readonly string[];
    statement: string;
    endsAt: string | null;
    active: boolean;
  }[];
}

export interface AccountAdministrationProperties {
  locale: AccountLocale;
  /** The roles that can be given. */
  /** Undefined while on its way (with `rules` and `banApplications`): the search shows at once and waits for them. */
  roles?: readonly { application: string; key: string; name: string }[];
  /** The rules a ban can cite (application null: everywhere). */
  rules?: readonly { application: string | null; code: string; title: string }[];
  /** The applications with a ban role. */
  banApplications?: readonly string[];
  /** An identifier (without `@`) or an email. */
  find: (query: string) => Promise<AccountAnswer<AdministeredAccount>>;
  grant: (input: {
    accountId: string;
    application: string;
    role: string;
    resource?: string;
    endsAt?: string;
    reason?: string;
  }) => Promise<AccountAnswer>;
  revoke: (grantId: string) => Promise<AccountAnswer>;
  ban: (input: {
    accountId: string;
    application: string;
    rules: string[];
    statement: string;
  }) => Promise<AccountAnswer>;
}
