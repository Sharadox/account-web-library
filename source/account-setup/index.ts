import { sql, type Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { syncApplication } from "@sharadox/account-web-library/application-sync";
import { grantRole } from "@sharadox/account-web-library/role-grant";
import { ACCOUNT_APPLICATION } from "@sharadox/account-web-library/account-application";

/**
 * Brings the account system's own application up to date (its permissions and roles) and makes the identifiers in
 * `ACCOUNT_ADMINISTRATORS` administrators, when they aren't already: the first administrator has to come from
 * somewhere. Runs at every start; safe to run again.
 *
 * @example
 * await setUpAccountSystem(database, { administrators: ["luis-pires"] });
 */
export async function setUpAccountSystem(
  database: Kysely<AccountDatabase>,
  { administrators }: { administrators: string[] },
): Promise<void> {
  await syncApplication(database, ACCOUNT_APPLICATION);
  for (const identifier of administrators) {
    const account = await database
      .selectFrom("identifier")
      .select("account_id")
      .where(sql<string>`lower(value)`, "=", identifier.toLowerCase())
      .executeTakeFirst();
    if (!account?.account_id) continue;
    const held = await database
      .selectFrom("role_grant")
      .innerJoin("role", "role.id", "role_grant.role_id")
      .select("role_grant.id")
      .where("role_grant.account_id", "=", account.account_id)
      .where("role.key", "=", "administrator")
      .where((where) =>
        where.or([where("role_grant.ends_at", "is", null), where("role_grant.ends_at", ">", new Date())]),
      )
      .executeTakeFirst();
    if (held) continue;
    await grantRole(database, {
      accountId: account.account_id,
      application: "account",
      role: "administrator",
      source: "system",
      reason: "ACCOUNT_ADMINISTRATORS",
    });
  }
}
