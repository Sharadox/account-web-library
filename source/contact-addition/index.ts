import type { Kysely } from "kysely";
import { uuidVersion7 } from "@sharadox/web-library/identifier/uuid-version-7";
import type { AccountDatabase } from "@sharadox/account-web-library/account-database/type";
import { recordAuditEvent } from "@sharadox/account-web-library/audit-event";
import type {
  ContactAdditionRequest,
  ContactAdditionResult,
} from "@sharadox/account-web-library/contact-addition/type";
import { normalizeContact } from "@sharadox/account-web-library/contact-kind";
import { databaseError } from "@sharadox/account-web-library/database-error";

/**
 * Adds a contact to an account, unverified until a one-time code sent to it comes back (`verifyContact`). Refuses
 * one the account already has, or one another account has verified. Ask for a fresh code first (step-up) and tell
 * the other contacts.
 *
 * @example
 * const result = await addContact(database, { accountId, contact: { kind: "email", value } });
 */
export async function addContact(
  database: Kysely<AccountDatabase>,
  { accountId, contact, now = Date.now() }: ContactAdditionRequest,
): Promise<ContactAdditionResult> {
  const { kind, value } = normalizeContact(contact);
  const contactId = uuidVersion7({ now });
  try {
    return await database.transaction().execute(async (transaction): Promise<ContactAdditionResult> => {
      const account = await transaction
        .selectFrom("account")
        .select("id")
        .where("id", "=", accountId)
        .executeTakeFirst();
      if (!account) return { added: false, reason: "no-account" };
      const owner = await transaction
        .selectFrom("contact")
        .select("account_id")
        .where("kind", "=", kind)
        .where("value", "=", value)
        .where("verified_at", "is not", null)
        .executeTakeFirst();
      if (owner && owner.account_id !== accountId) return { added: false, reason: "contact-taken" };
      await transaction
        .insertInto("contact")
        .values({ id: contactId, account_id: accountId, kind, value, verified_at: null, created_at: new Date(now) })
        .execute();
      await recordAuditEvent(transaction, { accountId, action: "contact.added", detail: { contactId, kind }, now });
      return { added: true, contactId };
    });
  } catch (error) {
    if (databaseError(error)?.constraint === "contact_per_account") return { added: false, reason: "already-added" };
    throw error;
  }
}
