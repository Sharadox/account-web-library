import type { AccountServer } from "@sharadox/account-web-library/account-server/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import type { Notice } from "@sharadox/account-web-library/contact-channel/type";

/**
 * Tells an account's owner something they must know (a new email, a recovery code used, a coming deletion), at every
 * verified contact but `except`, in the account's language. A failed send is recorded and doesn't stop the others.
 *
 * @example
 * after(() => notifyAccount(server, { accountId, notice: { kind: "recovery-code-used" } }));
 */
export async function notifyAccount(
  server: AccountServer,
  { accountId, notice, except }: { accountId: string; notice: Notice; except?: string },
): Promise<void> {
  const account = await server.database
    .selectFrom("account")
    .select("language")
    .where("id", "=", accountId)
    .executeTakeFirst();
  let contacts = server.database
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
      await recordAuditEvent(server.database, {
        accountId,
        action: "notice.delivery-failed",
        detail: { kind: notice.kind, error: `${name}: ${message}`.slice(0, 500) },
      });
    }
  }
}
