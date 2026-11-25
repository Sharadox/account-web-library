import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { InboxPage } from "@sharadox/account-web-library/notification-inbox/type";

/**
 * An account's inbox (the bell), newest first, `limit` at a time (`before`: the last id of the page before), with
 * how many are unread.
 *
 * @example
 * const { notifications, unread } = await listNotifications(database, { accountId, limit: 10 });
 */
export async function listNotifications(
  database: Kysely<AccountDatabase>,
  { accountId, limit = 20, before }: { accountId: string; limit?: number; before?: string },
): Promise<InboxPage> {
  let page = database
    .selectFrom("notification")
    .select(["id", "kind", "detail", "created_at", "read_at"])
    .where("account_id", "=", accountId);
  if (before) page = page.where("id", "<", before);
  const [rows, unread] = await Promise.all([
    page
      .orderBy("id", "desc")
      .limit(limit + 1)
      .execute(),
    database
      .selectFrom("notification")
      .select((select) => select.fn.countAll<string>().as("count"))
      .where("account_id", "=", accountId)
      .where("read_at", "is", null)
      .executeTakeFirstOrThrow(),
  ]);
  return {
    notifications: rows.slice(0, limit).map(({ id, kind, detail, created_at, read_at }) => ({
      id,
      kind,
      detail,
      createdAt: created_at,
      readAt: read_at,
    })),
    unread: Number(unread.count),
    more: rows.length > limit,
  };
}

/**
 * Marks the account's notifications as read: those in `ids`, or all of them. Returns how many changed.
 *
 * @example
 * await markNotificationsRead(database, { accountId }); // the bell's "Mark all as read"
 */
export async function markNotificationsRead(
  database: Kysely<AccountDatabase>,
  { accountId, ids, now = Date.now() }: { accountId: string; ids?: string[]; now?: number },
): Promise<number> {
  let update = database
    .updateTable("notification")
    .set({ read_at: new Date(now) })
    .where("account_id", "=", accountId)
    .where("read_at", "is", null);
  if (ids) {
    if (ids.length === 0) return 0;
    update = update.where("id", "in", ids);
  }
  return Number((await update.executeTakeFirst()).numUpdatedRows);
}

/**
 * Deletes one of the account's notifications.
 *
 * @example
 * await deleteNotification(database, { accountId, id }); // { deleted: true }
 */
export async function deleteNotification(
  database: Kysely<AccountDatabase>,
  { accountId, id }: { accountId: string; id: string },
): Promise<{ deleted: boolean }> {
  const result = await database
    .deleteFrom("notification")
    .where("id", "=", id)
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  return { deleted: result.numDeletedRows > 0n };
}

/**
 * Forgets every notification made before `before`, from the daily job (a year is kept). Returns how many.
 *
 * @example
 * await pruneNotifications(database, { before: new Date(Date.now() - 365 * 86_400_000) });
 */
export async function pruneNotifications(
  database: Kysely<AccountDatabase>,
  { before }: { before: Date },
): Promise<number> {
  const result = await database.deleteFrom("notification").where("created_at", "<", before).executeTakeFirst();
  return Number(result.numDeletedRows);
}
