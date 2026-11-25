import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountPermissions } from "@sharadox/account-web-library/account-permission";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { ROLE_ASSIGN_PERMISSION } from "@sharadox/account-web-library/role-grant";

/** A role by its application and key. */
function findRole(database: Kysely<AccountDatabase>, application: string, role: string) {
  return database
    .selectFrom("role")
    .innerJoin("application", "application.id", "role.application_id")
    .select(["role.id", "role.exclusive", "role.is_default"])
    .where("application.key", "=", application)
    .where("role.key", "=", role)
    .executeTakeFirst();
}

/**
 * How many grants a role has, active or not: what deleting it takes away (the administration page asks first).
 *
 * @example
 * const holders = await roleHolders(database, { application: "platform", role: "manager" });
 */
export async function roleHolders(
  database: Kysely<AccountDatabase>,
  { application, role }: { application: string; role: string },
): Promise<number> {
  const found = await findRole(database, application, role);
  if (!found) return 0;
  const count = await database
    .selectFrom("role_grant")
    .select((select) => select.fn.countAll<string>().as("count"))
    .where("role_id", "=", found.id)
    .executeTakeFirstOrThrow();
  return Number(count.count);
}

/**
 * Deletes a role and every grant of it, for someone allowed to give roles (`account.role.assign`); recorded in the
 * audit log with how many grants went. The default role and ban roles are protected: they come from the
 * configuration, and deleting a ban role would lift its bans. A role still in the configuration comes back, with no
 * grants, at the next sync.
 *
 * @example
 * await deleteRole(database, { application: "platform", role: "manager", actorAccountId }); // { deleted: true, grants: 2 }
 */
export async function deleteRole(
  database: Kysely<AccountDatabase>,
  {
    application,
    role,
    actorAccountId,
    now = Date.now(),
  }: { application: string; role: string; actorAccountId: string; now?: number },
): Promise<{ deleted: true; grants: number } | { deleted: false; reason: "no-role" | "protected" | "not-allowed" }> {
  const allowed = await accountPermissions(database, { accountId: actorAccountId, application: "account", now });
  if (!allowed.has(ROLE_ASSIGN_PERMISSION)) return { deleted: false, reason: "not-allowed" };
  const found = await findRole(database, application, role);
  if (!found) return { deleted: false, reason: "no-role" };
  if (found.exclusive || found.is_default) return { deleted: false, reason: "protected" };
  const grants = await roleHolders(database, { application, role });
  await database.transaction().execute(async (transaction) => {
    await transaction.deleteFrom("role").where("id", "=", found.id).execute();
    await recordAuditEvent(transaction, {
      actorAccountId,
      application,
      action: "role.deleted",
      detail: { role, grants },
      now,
    });
  });
  return { deleted: true, grants };
}
