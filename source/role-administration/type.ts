import type { AccountAnswer } from "@sharadox/account-web-library/account-action/type";
import type { AccountLocale } from "@sharadox/account-web-library/account-words/type";

/** A role as the administration lists it. */
export interface RoleRow {
  application: string;
  key: string;
  name: string;
  /** How many grants it has. */
  holders: number;
  /** The default role or a ban role: never deleted. */
  protected: boolean;
}

export interface RoleAdministrationProperties {
  locale: AccountLocale;
  /** Undefined while on its way: the panel shows at once, with skeletons where these will be. */
  roles?: readonly RoleRow[];
  remove: (application: string, role: string) => Promise<AccountAnswer>;
}
