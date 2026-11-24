import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";

/**
 * Signs an account out on one device (from its list of devices); only its own sessions can be ended.
 *
 * @example
 * await endAccountSession(database, { accountId, accountSessionId }); // { ended: true }
 */
export async function endAccountSession(
  database: Kysely<AccountDatabase>,
  { accountId, accountSessionId }: { accountId: string; accountSessionId: string },
): Promise<{ ended: boolean }> {
  return database.transaction().execute(async (transaction) => {
    const ended = await transaction
      .deleteFrom("account_session")
      .where("id", "=", accountSessionId)
      .where("account_id", "=", accountId)
      .executeTakeFirst();
    if (ended.numDeletedRows === 0n) return { ended: false };
    await recordAuditEvent(transaction, { accountId, action: "session.ended", detail: { accountSessionId } });
    return { ended: true };
  });
}
