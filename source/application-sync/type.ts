/** What an application declares in its code, synced at each deploy. */
export interface ApplicationDeclaration {
  /** Its permanent short name, the prefix of its permissions (`platform`). */
  key: string;
  name: string;
  /** Each starts with `<key>.`. */
  permissions: { key: string; description: string }[];
  roles: {
    key: string;
    name: string;
    /** Keys from `permissions`. */
    permissions: string[];
    /** The role every account holds without a grant (one at most). */
    default?: boolean;
    /** While granted, only this role's permissions count (a ban). */
    exclusive?: boolean;
  }[];
}

export type ApplicationSyncResult =
  | { synced: true }
  | { synced: false; reason: "foreign-permission" | "unknown-permission" | "defaults"; detail: string };
