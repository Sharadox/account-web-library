import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type {
  ApplicationDeclaration,
  ApplicationSyncResult,
} from "@sharadox/account-web-library/application-sync/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";

/**
 * Makes the database follow what an application declares in its code, all or nothing: the application, its
 * permissions (only its own: each starts with `<key>.`), and its roles with their permissions, the default one
 * (held by every account) and exclusive ones (bans). Permissions and roles no longer declared go, except a role
 * still granted, which stays until its grants end. Run it at every deploy.
 *
 * @example
 * await syncApplication(database, { key: "platform", name: "Platform", permissions, roles });
 */
export async function syncApplication(
  database: Kysely<AccountDatabase>,
  { key, name, permissions, roles }: ApplicationDeclaration,
): Promise<ApplicationSyncResult> {
  const foreign = permissions.find((permission) => !permission.key.startsWith(`${key}.`));
  if (foreign) return { synced: false, reason: "foreign-permission", detail: foreign.key };
  const declared = new Set(permissions.map((permission) => permission.key));
  const unknown = roles.flatMap((role) => role.permissions).find((permission) => !declared.has(permission));
  if (unknown) return { synced: false, reason: "unknown-permission", detail: unknown };
  const defaults = roles.filter((role) => role.default).map((role) => role.key);
  if (defaults.length > 1) return { synced: false, reason: "defaults", detail: defaults.join(", ") };
  await database.transaction().execute(async (transaction) => {
    const application = await transaction
      .insertInto("application")
      .values({ key, name })
      .onConflict((conflict) => conflict.column("key").doUpdateSet({ name }))
      .returning("id")
      .executeTakeFirstOrThrow();
    for (const permission of permissions)
      await transaction
        .insertInto("permission")
        .values({ id: uuidVersion7(), application_id: application.id, ...permission })
        .onConflict((conflict) => conflict.column("key").doUpdateSet({ description: permission.description }))
        .execute();
    let gone = transaction.deleteFrom("permission").where("application_id", "=", application.id);
    if (declared.size > 0) gone = gone.where("key", "not in", [...declared]);
    await gone.execute();
    const permissionIds = new Map(
      (
        await transaction
          .selectFrom("permission")
          .select(["id", "key"])
          .where("application_id", "=", application.id)
          .execute()
      ).map(({ id, key: permissionKey }) => [permissionKey, id]),
    );
    // The default moves only once every role is in place (one default per application at any moment).
    await transaction
      .updateTable("role")
      .set({ is_default: false })
      .where("application_id", "=", application.id)
      .execute();
    for (const role of roles) {
      const existing = await transaction
        .selectFrom("role")
        .select("id")
        .where("application_id", "=", application.id)
        .where("key", "=", role.key)
        .executeTakeFirst();
      const roleId = existing?.id ?? uuidVersion7();
      const values = { name: role.name, exclusive: role.exclusive ?? false };
      if (existing) await transaction.updateTable("role").set(values).where("id", "=", roleId).execute();
      else
        await transaction
          .insertInto("role")
          .values({ id: roleId, application_id: application.id, key: role.key, ...values })
          .execute();
      await transaction.deleteFrom("role_permission").where("role_id", "=", roleId).execute();
      if (role.permissions.length > 0)
        await transaction
          .insertInto("role_permission")
          .values(
            role.permissions.map((permission) => ({
              id: uuidVersion7(),
              role_id: roleId,
              permission_id: permissionIds.get(permission)!,
            })),
          )
          .execute();
    }
    if (defaults.length === 1)
      await transaction
        .updateTable("role")
        .set({ is_default: true })
        .where("application_id", "=", application.id)
        .where("key", "=", defaults[0]!)
        .execute();
    let undeclared = transaction
      .deleteFrom("role")
      .where("application_id", "=", application.id)
      .where(({ not, exists, selectFrom }) =>
        not(exists(selectFrom("role_grant").select("role_grant.id").whereRef("role_grant.role_id", "=", "role.id"))),
      );
    if (roles.length > 0)
      undeclared = undeclared.where(
        "key",
        "not in",
        roles.map((role) => role.key),
      );
    await undeclared.execute();
    await recordAuditEvent(transaction, { application: key, action: "application.synced" });
  });
  return { synced: true };
}
