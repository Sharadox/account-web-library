import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { bannedContactHash } from "@sharadox/account-web-library/banned-contact";
import { pictureKey } from "@sharadox/account-web-library/picture-key";
import type { PictureStorage } from "@sharadox/account-web-library/picture-storage/type";

/**
 * Deletes an account for good: its picture file, then the account with everything that belongs to it (identifier,
 * contacts, sessions, two-factor, agents), in one transaction. Its identifier is free at once. The audit log keeps
 * `account.deleted` and earlier events under the bare id, with no personal data. An account banned somewhere leaves
 * its contacts in the banned-contact ledger (HMACs under `ledgerPepper`) until the ban ends. Ask for a fresh code
 * first (step-up).
 *
 * @example
 * await deleteAccount(database, storage, { accountId, ledgerPepper }); // { deleted: true }
 */
export async function deleteAccount(
  database: Kysely<AccountDatabase>,
  storage: PictureStorage,
  { accountId, ledgerPepper, now = Date.now() }: { accountId: string; ledgerPepper: string; now?: number },
): Promise<{ deleted: boolean }> {
  const picture = await database
    .selectFrom("account_picture")
    .select("id")
    .where("account_id", "=", accountId)
    .executeTakeFirst();
  if (picture) await storage.remove(pictureKey(picture.id));
  return database.transaction().execute(async (transaction) => {
    // An account banned somewhere leaves its contacts' HMACs, so it can't come back as new until the ban ends.
    const bans = await transaction
      .selectFrom("ban")
      .innerJoin("role_grant", "role_grant.id", "ban.grant_id")
      .innerJoin("role", "role.id", "role_grant.role_id")
      .select(["ban.id", "role.application_id", "role_grant.ends_at"])
      .where("ban.account_id", "=", accountId)
      .where((where) =>
        where.or([where("role_grant.ends_at", "is", null), where("role_grant.ends_at", ">", new Date(now))]),
      )
      .execute();
    if (bans.length > 0) {
      const contacts = await transaction
        .selectFrom("contact")
        .select(["kind", "value"])
        .where("account_id", "=", accountId)
        .where("verified_at", "is not", null)
        .execute();
      for (const ban of bans) {
        const rules = await transaction
          .selectFrom("ban_rule")
          .innerJoin("rule", "rule.id", "ban_rule.rule_id")
          .select("rule.code")
          .where("ban_rule.ban_id", "=", ban.id)
          .execute();
        await transaction
          .insertInto("banned_contact")
          .values(
            contacts.map((contact) => ({
              id: uuidVersion7({ now }),
              contact_hash: bannedContactHash(contact, ledgerPepper),
              application_id: ban.application_id,
              ends_at: ban.ends_at,
              rule_codes: rules.map(({ code }) => code),
            })),
          )
          .execute();
      }
    }
    const deleted = await transaction.deleteFrom("account").where("id", "=", accountId).executeTakeFirst();
    if (deleted.numDeletedRows === 0n) return { deleted: false };
    await recordAuditEvent(transaction, { accountId, action: "account.deleted", now });
    return { deleted: true };
  });
}
