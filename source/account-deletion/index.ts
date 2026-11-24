import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { pictureKey } from "@sharadox/account-web-library/picture-key";
import type { PictureStorage } from "@sharadox/account-web-library/picture-storage/type";

/**
 * Deletes an account for good: its picture file, then the account with everything that belongs to it (identifier,
 * contacts, sessions, two-factor, agents), in one transaction. Its identifier is free at once. The audit log keeps
 * `account.deleted` and earlier events under the bare id, with no personal data. Ask for a fresh code first
 * (step-up).
 *
 * @example
 * await deleteAccount(database, storage, { accountId }); // { deleted: true }
 */
export async function deleteAccount(
  database: Kysely<AccountDatabase>,
  storage: PictureStorage,
  { accountId }: { accountId: string },
): Promise<{ deleted: boolean }> {
  const picture = await database
    .selectFrom("account_picture")
    .select("id")
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  if (picture) await storage.remove(pictureKey(picture.id));
  return database.transaction().execute(async (transaction) => {
    const deleted = await transaction.deleteFrom("account").where("id", "=", accountId).executeTakeFirst();
    if (deleted.numDeletedRows === 0n) return { deleted: false };
    await recordAuditEvent(transaction, { accountId, action: "account.deleted" });
    return { deleted: true };
  });
}
