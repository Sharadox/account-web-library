import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountActivityPage } from "@sharadox/account-web-library/account-activity/type";

/**
 * The account's own history from the audit log, newest first, `limit` (50 by default) at a time: pass the page's
 * `next` as `before` for older events (UUIDv7 ids sort by time).
 *
 * @example
 * const { events, next } = await listAccountActivity(database, { accountId });
 */
export async function listAccountActivity(
  database: Kysely<AccountDatabase>,
  { accountId, before, limit = 50 }: { accountId: string; before?: string; limit?: number },
): Promise<AccountActivityPage> {
  let query = database
    .selectFrom("audit_event")
    .select(["id", "at", "action", "detail"])
    .where("account_id", "=", accountId);
  if (before) query = query.where("id", "<", before);
  const events = await query.orderBy("id", "desc").limit(limit).execute();
  return { events, next: events.length === limit ? events.at(-1)!.id : null };
}
