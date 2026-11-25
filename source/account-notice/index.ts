import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import type { Notice } from "@sharadox/account-web-library/contact-channel/type";
import { noticeEnabled } from "@sharadox/account-web-library/notification-preference";

/** A notice's details for the inbox, its dates written as ISO strings. */
function detail(notice: Notice): string {
  return JSON.stringify(notice, (key, value: unknown) => (key === "kind" ? undefined : value));
}

/**
 * Tells an account's owner something they must know (a new email, a recovery code used, a coming deletion): in its
 * inbox (the bell), and at every verified contact but `except`, in the account's language, each unless the owner
 * turned that channel off for this kind (see `setNotificationPreference`). A failed send is recorded and doesn't
 * stop the others.
 *
 * @example
 * after(() => notifyAccount(server, { accountId, notice: { kind: "recovery-code-used" } }));
 */
export async function notifyAccount(
  server: AccountServer,
  { accountId, notice, except, now = Date.now() }: { accountId: string; notice: Notice; except?: string; now?: number },
): Promise<void> {
  const { database } = server;
  if (await noticeEnabled(database, { accountId, kind: notice.kind, channel: "in-app" }))
    await database
      .insertInto("notification")
      .values({ id: uuidVersion7({ now }), account_id: accountId, kind: notice.kind, detail: detail(notice) })
      .execute();
  if (!(await noticeEnabled(database, { accountId, kind: notice.kind, channel: "email" }))) return;
  const account = await database
    .selectFrom("account")
    .select("language")
    .where("id", "=", accountId)
    .executeTakeFirst();
  let contacts = database
    .selectFrom("contact")
    .select(["id", "kind", "value"])
    .where("account_id", "=", accountId)
    .where("verified_at", "is not", null);
  if (except) contacts = contacts.where("id", "!=", except);
  for (const contact of await contacts.orderBy("id").execute()) {
    const channel = server.channels.find(({ kind }) => kind === contact.kind);
    try {
      await channel?.notify?.({
        contact: { kind: contact.kind, value: contact.value },
        language: account?.language ?? "en",
        notice,
      });
    } catch (error) {
      const { name, message } = error as Error;
      await recordAuditEvent(database, {
        accountId,
        action: "notice.delivery-failed",
        detail: { kind: notice.kind, error: `${name}: ${message}`.slice(0, 500) },
      });
    }
  }
}
