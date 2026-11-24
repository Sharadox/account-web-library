import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { databaseError } from "@sharadox/account-web-library/database-error";
import { checkIdentifier } from "@sharadox/account-web-library/identifier";
import type { IdentifierChangeResult } from "@sharadox/account-web-library/identifier-change/type";

/**
 * Changes an account's identifier whenever its owner wants; the old one is free for anyone at once. Accounts are
 * referenced by id, so nothing breaks; the audit log keeps the history. Changing only the case is allowed.
 *
 * @example
 * await changeIdentifier(database, { accountId, identifier: "Luis-Pires" }); // { changed: true }
 */
export async function changeIdentifier(
  database: Kysely<AccountDatabase>,
  { accountId, identifier }: { accountId: string; identifier: string },
): Promise<IdentifierChangeResult> {
  if (!checkIdentifier(identifier).valid) return { changed: false, reason: "identifier-invalid" };
  try {
    return await database.transaction().execute(async (transaction): Promise<IdentifierChangeResult> => {
      const current = await transaction
        .selectFrom("identifier")
        .select("value")
        .where("account_id", "=", accountId)
        .forUpdate()
        .executeTakeFirst();
      if (!current) return { changed: false, reason: "no-account" };
      await transaction
        .updateTable("identifier")
        .set({ value: identifier })
        .where("account_id", "=", accountId)
        .execute();
      await recordAuditEvent(transaction, {
        accountId,
        action: "account.identifier-changed",
        detail: { from: current.value, to: identifier },
      });
      return { changed: true };
    });
  } catch (error) {
    if (databaseError(error)?.constraint === "identifier_value_key")
      return { changed: false, reason: "identifier-taken" };
    throw error;
  }
}
