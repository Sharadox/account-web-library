import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { databaseError } from "@sharadox/account-web-library/database-error";
import { checkUsername } from "@sharadox/account-web-library/username";
import type { UsernameChangeResult } from "@sharadox/account-web-library/username-change/type";

/**
 * Changes an account's username whenever its owner wants; the old one is free for anyone at once. Accounts are
 * referenced by id, so nothing breaks; the audit log keeps the history. Changing only the case is allowed.
 *
 * @example
 * await changeUsername(database, { accountId, username: "Luis-Pires" }); // { changed: true }
 */
export async function changeUsername(
  database: Kysely<AccountDatabase>,
  { accountId, username }: { accountId: string; username: string },
): Promise<UsernameChangeResult> {
  if (!checkUsername(username).valid) return { changed: false, reason: "username-invalid" };
  try {
    return await database.transaction().execute(async (transaction): Promise<UsernameChangeResult> => {
      const current = await transaction
        .selectFrom("account")
        .select("username")
        .where("id", "=", accountId)
        .forUpdate()
        .executeTakeFirst();
      if (!current) return { changed: false, reason: "no-account" };
      await transaction.updateTable("account").set({ username }).where("id", "=", accountId).execute();
      await recordAuditEvent(transaction, {
        accountId,
        action: "account.username-changed",
        detail: { from: current.username, to: username },
      });
      return { changed: true };
    });
  } catch (error) {
    if (databaseError(error)?.constraint === "account_username_key")
      return { changed: false, reason: "username-taken" };
    throw error;
  }
}
