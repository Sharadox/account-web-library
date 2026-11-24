import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { databaseError } from "@sharadox/account-web-library/database-error";

/**
 * Marks an account's contact verified, once the one-time code sent to it came back. Refuses when another account
 * verified the same contact first (a verified contact belongs to one account only).
 *
 * @example
 * await verifyContact(database, { accountId, contactId }); // { verified: true }
 */
export async function verifyContact(
  database: Kysely<AccountDatabase>,
  { accountId, contactId, now = Date.now() }: { accountId: string; contactId: string; now?: number },
): Promise<{ verified: true } | { verified: false; reason: "no-contact" | "contact-taken" }> {
  try {
    return await database.transaction().execute(async (transaction) => {
      const updated = await transaction
        .updateTable("contact")
        .set({ verified_at: new Date(now) })
        .where("id", "=", contactId)
        .where("account_id", "=", accountId)
        .returning("kind")
        .executeTakeFirst();
      if (!updated) return { verified: false, reason: "no-contact" } as const;
      await recordAuditEvent(transaction, {
        accountId,
        action: "contact.verified",
        detail: { contactId, kind: updated.kind },
        now,
      });
      return { verified: true } as const;
    });
  } catch (error) {
    if (databaseError(error)?.constraint === "contact_verified") return { verified: false, reason: "contact-taken" };
    throw error;
  }
}
