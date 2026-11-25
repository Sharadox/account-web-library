import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountPermissionQuestion } from "@sharadox/account-web-library/account-permission/type";
import { effectivePermissions } from "@sharadox/account-web-library/effective-permissions";
import type { Grant, Role } from "@sharadox/account-web-library/effective-permissions/type";

/**
 * What an account may do in one application now, from the database: the application's default role, the account's
 * active grants (an active exclusive one, a ban, leaving only its own permissions), limited to `scope`, and for an
 * agent to what its owner may do right now. An unknown application gives nothing.
 *
 * @example
 * const permissions = await accountPermissions(database, { accountId, application: "platform" });
 * if (!permissions.has("platform.job.create")) return forbidden();
 */
export async function accountPermissions(
  database: Kysely<AccountDatabase>,
  { accountId, application, resource, scope, now = Date.now() }: AccountPermissionQuestion,
): Promise<Set<string>> {
  const app = await database.selectFrom("application").select("id").where("key", "=", application).executeTakeFirst();
  if (!app) return new Set();
  const rows = await database
    .selectFrom("role")
    .leftJoin("application", "application.id", "role.application_id")
    .leftJoin("role_permission", "role_permission.role_id", "role.id")
    .leftJoin("permission", "permission.id", "role_permission.permission_id")
    .select([
      "role.id",
      "application.key as application",
      "role.exclusive",
      "role.is_default",
      "permission.key as permission",
    ])
    .where((where) => where.or([where("role.application_id", "=", app.id), where("role.application_id", "is", null)]))
    .execute();
  const roles = new Map<string, Role & { isDefault: boolean }>();
  for (const row of rows) {
    const role = roles.get(row.id) ?? {
      id: row.id,
      application: row.application,
      permissions: [],
      exclusive: row.exclusive,
      isDefault: row.is_default,
    };
    if (row.permission) role.permissions.push(row.permission);
    roles.set(row.id, role);
  }
  const grants: Grant[] = (
    await database
      .selectFrom("role_grant")
      .innerJoin("role", "role.id", "role_grant.role_id")
      .leftJoin("application", "application.id", "role.application_id")
      .select([
        "role_grant.role_id",
        "application.key as application",
        "role_grant.resource",
        "role_grant.starts_at",
        "role_grant.ends_at",
      ])
      .where("role_grant.account_id", "=", accountId)
      .execute()
  ).map((grant) => ({
    roleId: grant.role_id,
    application: grant.application,
    resource: grant.resource,
    startsAt: grant.starts_at.getTime(),
    endsAt: grant.ends_at ? grant.ends_at.getTime() : null,
  }));
  const account = await database
    .selectFrom("account")
    .select("owner_id")
    .where("id", "=", accountId)
    .executeTakeFirst();
  const ownerPermissions = account?.owner_id
    ? await accountPermissions(database, {
        accountId: account.owner_id,
        application,
        ...(resource ? { resource } : {}),
        now,
      })
    : undefined;
  const defaultRole = [...roles.values()].find((role) => role.isDefault) ?? {
    id: "",
    application,
    permissions: [],
    exclusive: false,
  };
  return effectivePermissions({
    application,
    ...(resource ? { resource } : {}),
    now,
    defaultRole,
    roles: [...roles.values()],
    grants,
    ...(scope ? { scope } : {}),
    ...(ownerPermissions ? { ownerPermissions } : {}),
  });
}
