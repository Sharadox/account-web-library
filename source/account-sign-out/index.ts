import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { hashSessionToken } from "@sharadox/account-web-library/session-token";

/**
 * Signs one account out of a browser (`accountId`), or every account and the browser session with it. Returns the
 * accounts signed out; tell their applications (back-channel logout) so they end their own sessions too.
 *
 * @example
 * await signOut(database, { token: cookies.get("__Host-account")?.value, accountId });
 */
export async function signOut(
  database: Kysely<AccountDatabase>,
  { token, accountId }: { token: string | undefined; accountId?: string },
): Promise<{ signedOut: string[] }> {
  if (!token) return { signedOut: [] };
  return database.transaction().execute(async (transaction) => {
    const browser = await transaction
      .selectFrom("browser_session")
      .select("id")
      .where("token_hash", "=", hashSessionToken(token))
      .forUpdate()
      .executeTakeFirst();
    if (!browser) return { signedOut: [] };
    let removal = transaction.deleteFrom("account_session").where("browser_session_id", "=", browser.id);
    if (accountId) removal = removal.where("account_id", "=", accountId);
    const removed = await removal.returning("account_id").execute();
    if (!accountId) await transaction.deleteFrom("browser_session").where("id", "=", browser.id).execute();
    for (const { account_id } of removed) {
      await recordAuditEvent(transaction, { accountId: account_id, action: "session.signed-out" });
    }
    return { signedOut: removed.map(({ account_id }) => account_id) };
  });
}
