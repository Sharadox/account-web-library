import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AuditEvent } from "@sharadox/account-web-library/audit-event/type";

/**
 * Adds a line to the append-only audit log (the database refuses changes to it). Pass a transaction to record it
 * together with the change it describes. Returns the event's UUIDv7.
 *
 * @example
 * await recordAuditEvent(transaction, { accountId, action: "contact.removed", detail: { contactId } });
 */
export async function recordAuditEvent(
  database: Kysely<AccountDatabase>,
  { accountId = null, actorAccountId = null, application = null, action, detail = {}, now = Date.now() }: AuditEvent,
): Promise<string> {
  const id = uuidVersion7({ now });
  let applicationId: string | null = null;
  if (application !== null) {
    const found = await database
      .selectFrom("application")
      .select("id")
      .where("key", "=", application)
      .executeTakeFirst();
    if (!found) throw new Error(`no application "${application}"`);
    applicationId = found.id;
  }
  await database
    .insertInto("audit_event")
    .values({
      id,
      at: new Date(now),
      account_id: accountId,
      actor_account_id: actorAccountId,
      application_id: applicationId,
      action,
      detail,
    })
    .execute();
  return id;
}

/**
 * Forgets audit events older than `before`, from the daily job: the log is kept a year, as the privacy policy says.
 * Returns how many went.
 *
 * @example
 * await pruneAuditEvents(database, { before: new Date(Date.now() - 365 * 86_400_000) });
 */
export async function pruneAuditEvents(
  database: Kysely<AccountDatabase>,
  { before }: { before: Date },
): Promise<number> {
  const result = await database.deleteFrom("audit_event").where("at", "<", before).executeTakeFirst();
  return Number(result.numDeletedRows);
}
