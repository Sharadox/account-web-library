import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";

/**
 * Signs an account out on every browser at once: after a ban, a lost device, a recovery, or when its owner asks.
 * Records who did it. Returns how many sessions ended.
 *
 * @example
 * await revokeAccountSessions(database, { accountId, actorAccountId: moderatorId });
 */
export async function revokeAccountSessions(
  database: Kysely<AccountDatabase>,
  { accountId, actorAccountId = null }: { accountId: string; actorAccountId?: string | null },
): Promise<number> {
  return database.transaction().execute(async (transaction) => {
    const removed = await transaction
      .deleteFrom("account_session")
      .where("account_id", "=", accountId)
      .returning("id")
      .execute();
    await recordAuditEvent(transaction, {
      accountId,
      actorAccountId,
      action: "session.revoked",
      detail: { sessions: removed.length },
    });
    return removed.length;
  });
}
