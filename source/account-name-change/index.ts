import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { checkAccountName } from "@sharadox/account-web-library/account-name";
import type { AccountNameChangeResult } from "@sharadox/account-web-library/account-name-change/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";

/**
 * Changes the name an account shows (tidied by `checkAccountName`). The audit log records that it changed, not the
 * names, which are personal data.
 *
 * @example
 * await changeAccountName(database, { accountId, name: "Luis Pires" }); // { changed: true }
 */
export async function changeAccountName(
  database: Kysely<AccountDatabase>,
  { accountId, name }: { accountId: string; name: string },
): Promise<AccountNameChangeResult> {
  const check = checkAccountName(name);
  if (!check.valid) return { changed: false, reason: "name-invalid" };
  return database.transaction().execute(async (transaction): Promise<AccountNameChangeResult> => {
    const updated = await transaction
      .updateTable("account")
      .set({ name: check.name })
      .where("id", "=", accountId)
      .executeTakeFirst();
    if (updated.numUpdatedRows === 0n) return { changed: false, reason: "no-account" };
    await recordAuditEvent(transaction, { accountId, action: "account.name-changed" });
    return { changed: true };
  });
}
