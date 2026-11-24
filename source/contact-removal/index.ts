import type { Kysely } from "kysely";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import { databaseError } from "@sharadox/account-web-library/database-error";

/**
 * Removes a contact from an account. Refuses to remove the last verified sign-in contact of a person (the database
 * checks it when the change commits). Ask for a fresh code first (step-up) and tell the other contacts.
 *
 * @example
 * const result = await removeContact(database, { accountId, contactId });
 */
export async function removeContact(
  database: Kysely<AccountDatabase>,
  { accountId, contactId }: { accountId: string; contactId: string },
): Promise<{ removed: true } | { removed: false; reason: "no-contact" | "last-sign-in-contact" }> {
  try {
    return await database.transaction().execute(async (transaction) => {
      const removed = await transaction
        .deleteFrom("contact")
        .where("id", "=", contactId)
        .where("account_id", "=", accountId)
        .returning("kind")
        .executeTakeFirst();
      if (!removed) return { removed: false, reason: "no-contact" } as const;
      await recordAuditEvent(transaction, {
        accountId,
        action: "contact.removed",
        detail: { contactId, kind: removed.kind },
      });
      return { removed: true } as const;
    });
  } catch (error) {
    if (databaseError(error)?.code === "23514") return { removed: false, reason: "last-sign-in-contact" };
    throw error;
  }
}
