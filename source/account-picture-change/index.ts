import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import type { AccountPictureChangeResult } from "@sharadox/account-web-library/account-picture-change/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { pictureKey } from "@sharadox/account-web-library/picture-key";
import { preparePicture } from "@sharadox/account-web-library/picture-preparation";
import type { PictureStorage } from "@sharadox/account-web-library/picture-storage/type";

/**
 * Sets an account's picture from an uploaded file (checked and made safe by `preparePicture`): the new file is
 * stored first, then the database points to it, then the old file is deleted, so the account is never left without
 * a working picture and replaced files never stay behind.
 *
 * @example
 * const result = await setAccountPicture(database, storage, { accountId, bytes });
 * if (result.changed) revalidate(result.pictureId);
 */
export async function setAccountPicture(
  database: Kysely<AccountDatabase>,
  storage: PictureStorage,
  { accountId, bytes, now = Date.now() }: { accountId: string; bytes: Uint8Array; now?: number },
): Promise<AccountPictureChangeResult> {
  const prepared = await preparePicture(bytes);
  if (!prepared.valid) return { changed: false, reason: prepared.reason };
  const account = await database.selectFrom("account").select("id").where("id", "=", accountId).executeTakeFirst();
  if (!account) return { changed: false, reason: "no-account" };
  const pictureId = uuidVersion7({ now });
  await storage.put(pictureKey(pictureId), prepared.bytes, "image/webp");
  const old = await database.transaction().execute(async (transaction) => {
    const previous = await transaction
      .deleteFrom("account_picture")
      .where("account_id", "=", accountId)
      .returning("id")
      .executeTakeFirst();
    await transaction
      .insertInto("account_picture")
      .values({
        id: pictureId,
        account_id: accountId,
        content_type: "image/webp",
        byte_size: prepared.bytes.length,
        width: prepared.width,
        height: prepared.height,
        created_at: new Date(now),
      })
      .execute();
    await recordAuditEvent(transaction, { accountId, action: "account.picture-changed", detail: { pictureId }, now });
    return previous;
  });
  if (old) await storage.remove(pictureKey(old.id));
  return { changed: true, pictureId };
}

/**
 * Removes an account's picture and deletes its file.
 *
 * @example
 * await removeAccountPicture(database, storage, { accountId }); // { removed: true }
 */
export async function removeAccountPicture(
  database: Kysely<AccountDatabase>,
  storage: PictureStorage,
  { accountId }: { accountId: string },
): Promise<{ removed: boolean }> {
  const removed = await database.transaction().execute(async (transaction) => {
    const picture = await transaction
      .deleteFrom("account_picture")
      .where("account_id", "=", accountId)
      .returning("id")
      .executeTakeFirst();
    if (picture) await recordAuditEvent(transaction, { accountId, action: "account.picture-removed" });
    return picture;
  });
  if (!removed) return { removed: false };
  await storage.remove(pictureKey(removed.id));
  return { removed: true };
}
