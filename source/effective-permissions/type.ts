/** A role: its application (`null` for every application), its permissions, and whether it is a ban (`exclusive`). */
export interface Role {
  id: string;
  application: string | null;
  permissions: string[];
  /** While active, the account has only this role's permissions in its application (how bans work). */
  exclusive: boolean;
}

/** A role given to an account: in an application (or `null`, all), maybe for one resource, between two moments. */
export interface Grant {
  roleId: string;
  application: string | null;
  /** `platform:project:42`, or `null` for the whole application. */
  resource: string | null;
  /** Milliseconds since 1970. */
  startsAt: number;
  /** Milliseconds since 1970, or `null` for permanent. */
  endsAt: number | null;
}

export interface EffectivePermissionsInput {
  /** The application asking, for example `platform`; its permissions start with `platform.`. */
  application: string;
  /** The resource the action is on, for roles limited to one resource. */
  resource?: string;
  now: number;
  /** The application's default role, which every account holds. */
  defaultRole: Role;
  /** Every role that may be granted. */
  roles: Role[];
  /** The account's grants. */
  grants: Grant[];
  /** A token's or key's scope: at most these. */
  scope?: string[];
  /** An agent's owner's effective permissions: at most these. */
  ownerPermissions?: Set<string>;
}
