import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { accountPermissions } from "@sharadox/account-web-library/account-permission";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { databaseError } from "@sharadox/account-web-library/database-error";
import type { GrantView, RoleGrantRequest, RoleGrantResult } from "@sharadox/account-web-library/role-grant/type";

/** The permission that lets an account give roles, in the account system's own application. */
export const ROLE_ASSIGN_PERMISSION = "account.role.assign";

/**
 * Gives an account a role in an application, maybe for one resource and a time. Given by someone (`grantedBy`), it
 * needs their `account.role.assign` and every permission the role has, there: nobody hands out more than they hold.
 * Recorded in the audit log.
 *
 * @example
 * await grantRole(database, { accountId, application: "platform", role: "manager", grantedBy: admin });
 */
export async function grantRole(
  database: Kysely<AccountDatabase>,
  {
    accountId,
    application,
    role,
    resource,
    startsAt,
    endsAt,
    source = "manual",
    grantedBy,
    reason,
    now = Date.now(),
  }: RoleGrantRequest,
): Promise<RoleGrantResult> {
  const found = await database
    .selectFrom("role")
    .innerJoin("application", "application.id", "role.application_id")
    .leftJoin("role_permission", "role_permission.role_id", "role.id")
    .leftJoin("permission", "permission.id", "role_permission.permission_id")
    .select(["role.id", "permission.key as permission"])
    .where("application.key", "=", application)
    .where("role.key", "=", role)
    .execute();
  if (found.length === 0) return { granted: false, reason: "no-role" };
  if (grantedBy) {
    const assigning = await accountPermissions(database, { accountId: grantedBy, application: "account", now });
    if (!assigning.has(ROLE_ASSIGN_PERMISSION)) return { granted: false, reason: "not-allowed" };
    const held = await accountPermissions(database, {
      accountId: grantedBy,
      application,
      now,
      ...(resource ? { resource } : {}),
    });
    if (found.some(({ permission }) => permission && !held.has(permission)))
      return { granted: false, reason: "escalation" };
  }
  const grantId = uuidVersion7({ now });
  try {
    await database.transaction().execute(async (transaction) => {
      await transaction
        .insertInto("role_grant")
        .values({
          id: grantId,
          account_id: accountId,
          role_id: found[0]!.id,
          resource: resource ?? null,
          starts_at: new Date(startsAt ?? now),
          ends_at: endsAt === undefined ? null : new Date(endsAt),
          source,
          granted_by: grantedBy ?? null,
          reason: reason ?? null,
        })
        .execute();
      await recordAuditEvent(transaction, {
        accountId,
        actorAccountId: grantedBy ?? null,
        application,
        action: "role.granted",
        detail: { grantId, role, source },
        now,
      });
    });
  } catch (error) {
    if (databaseError(error)?.constraint === "role_grant_account_id_fkey")
      return { granted: false, reason: "no-account" };
    throw error;
  }
  return { granted: true, grantId };
}

/**
 * Ends a grant now (a grant not started yet goes), keeping its history. Recorded in the audit log.
 *
 * @example
 * await revokeGrant(database, { grantId, revokedBy: admin }); // { revoked: true }
 */
export async function revokeGrant(
  database: Kysely<AccountDatabase>,
  { grantId, revokedBy, now = Date.now() }: { grantId: string; revokedBy?: string; now?: number },
): Promise<{ revoked: boolean }> {
  const at = new Date(now);
  return database.transaction().execute(async (transaction) => {
    const ended = await transaction
      .updateTable("role_grant")
      .set({ ends_at: at })
      .where("id", "=", grantId)
      .where("starts_at", "<", at)
      .where((where) => where.or([where("ends_at", "is", null), where("ends_at", ">", at)]))
      .returning("account_id")
      .executeTakeFirst();
    const gone = ended
      ? undefined
      : await transaction
          .deleteFrom("role_grant")
          .where("id", "=", grantId)
          .where("starts_at", ">=", at)
          .returning("account_id")
          .executeTakeFirst();
    const accountId = ended?.account_id ?? gone?.account_id;
    if (!accountId) return { revoked: false };
    await recordAuditEvent(transaction, {
      accountId,
      actorAccountId: revokedBy ?? null,
      action: "role.revoked",
      detail: { grantId },
      now,
    });
    return { revoked: true };
  });
}

/**
 * An account's grants, newest first, each with its role and whether it is active now.
 *
 * @example
 * const grants = await listGrants(database, { accountId });
 */
export async function listGrants(
  database: Kysely<AccountDatabase>,
  { accountId, now = Date.now() }: { accountId: string; now?: number },
): Promise<GrantView[]> {
  const rows = await database
    .selectFrom("role_grant")
    .innerJoin("role", "role.id", "role_grant.role_id")
    .leftJoin("application", "application.id", "role.application_id")
    .select([
      "role_grant.id as grantId",
      "application.key as application",
      "role.key as role",
      "role.name as roleName",
      "role_grant.resource",
      "role_grant.starts_at as startsAt",
      "role_grant.ends_at as endsAt",
      "role_grant.source",
      "role_grant.reason",
    ])
    .where("role_grant.account_id", "=", accountId)
    .orderBy("role_grant.id", "desc")
    .execute();
  return rows.map((row) => ({
    ...row,
    active: row.startsAt.getTime() <= now && (row.endsAt === null || now < row.endsAt.getTime()),
  }));
}
