import type { EffectivePermissionsInput, Grant } from "@sharadox/account-web-library/effective-permissions/type";

/** A permission the account system itself handles (`account.ban.read`, `account.data.export`…), in every application. */
const ACCOUNT_PERMISSION = "account.";

/**
 * What an account may do in one application, now. In order:
 * 1. Active grants count: started, not ended, in this application or global, and for the whole application or this
 *    resource.
 * 2. An active exclusive grant (a ban) leaves only the exclusive roles' permissions.
 * 3. Otherwise the result is the default role plus every active role.
 * 4. Only this application's permissions (`platform.…`) and the account system's own (`account.…`) are kept.
 * 5. The result is limited to `scope` (a token or key) and to `ownerPermissions` (an agent).
 *
 * @example
 * const permissions = effectivePermissions({ application: "platform", now: Date.now(), defaultRole, roles, grants });
 * if (!permissions.has("platform.job.create")) return forbidden();
 */
export function effectivePermissions({
  application,
  resource,
  now,
  defaultRole,
  roles,
  grants,
  scope,
  ownerPermissions,
}: EffectivePermissionsInput): Set<string> {
  const byId = new Map(roles.map((role) => [role.id, role]));
  const applies = (grant: Grant) =>
    grant.startsAt <= now &&
    (grant.endsAt === null || now < grant.endsAt) &&
    (grant.application === null || grant.application === application) &&
    (grant.resource === null || grant.resource === resource);
  const active = grants.filter(applies).flatMap((grant) => byId.get(grant.roleId) ?? []);
  const exclusive = active.filter((role) => role.exclusive);
  const granted = exclusive.length > 0 ? exclusive : [defaultRole, ...active];
  const permissions = new Set(
    granted
      .flatMap((role) => role.permissions)
      .filter((permission) => permission.startsWith(`${application}.`) || permission.startsWith(ACCOUNT_PERMISSION)),
  );
  const limits = [scope && new Set(scope), ownerPermissions].filter((limit) => limit !== undefined);
  return new Set([...permissions].filter((permission) => limits.every((limit) => limit.has(permission))));
}
